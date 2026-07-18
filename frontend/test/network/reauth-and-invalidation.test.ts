// test/network/reauth-and-invalidation.test.ts
//
// Network-level tests through the REAL data layer: MSW fakes only the HTTP
// responses, so baseQueryWithReauth (mutex, refresh-and-retry, the
// non-session 401 list), endpoint URL building, and cross-domain cache tag
// invalidation all execute exactly as in production. Nothing from
// src/redux is mocked.
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { setupServer } from "msw/node";
import { delay, http, HttpResponse } from "msw";
import { configureStore } from "@reduxjs/toolkit";
import { apiSlice } from "@/redux/apiSlice";
import authReducer from "@/redux/auth/authSlice";
import { bookingApi } from "@/redux/bookingApi";
import { paymentApi } from "@/redux/paymentApi";

const API = "http://localhost:9999/api/v1";

const server = setupServer();

beforeAll(() => {
  // Any request without a handler is a test bug, not a silent pass.
  server.listen({ onUnhandledRequest: "error" });
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

/** A fresh store per test so RTK Query's cache never leaks across cases. */
const makeStore = () =>
  configureStore({
    reducer: {
      auth: authReducer,
      [apiSlice.reducerPath]: apiSlice.reducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(apiSlice.middleware),
  });

const bookingsPage = {
  message: "ok",
  data: [{ id: 1, status: "CONFIRMED", totalPrice: 1000 }],
  meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
};

const paymentsPage = {
  message: "ok",
  data: [{ id: 7, status: "COMPLETED", amount: 1000 }],
  meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
};

const refreshOk = {
  message: "ok",
  data: { id: 1, name: "Test User", email: "t@example.com", role: "ADMIN" },
};

describe("baseQueryWithReauth", () => {
  it("refreshes once on a session-expiry 401 and retries the original request", async () => {
    let bookingsCalls = 0;
    let refreshCalls = 0;

    server.use(
      http.get(`${API}/bookings`, () => {
        bookingsCalls += 1;
        if (bookingsCalls === 1) {
          return HttpResponse.json(
            { status: "error", message: "Access token expired.", code: "EXPIRED_TOKEN" },
            { status: 401 }
          );
        }
        return HttpResponse.json(bookingsPage);
      }),
      http.post(`${API}/auth/refresh-token`, () => {
        refreshCalls += 1;
        return HttpResponse.json(refreshOk);
      })
    );

    const store = makeStore();
    const result = await store.dispatch(
      bookingApi.endpoints.getAllBookings.initiate({})
    );

    expect(result.data).toEqual(bookingsPage);
    expect(refreshCalls).toBe(1);
    expect(bookingsCalls).toBe(2);
    // The refresh response's user lands in auth state.
    expect(store.getState().auth.user).toEqual(refreshOk.data);
  });

  it("does NOT refresh on a wrong-credential 401 (would double-count lockout)", async () => {
    let bookingsCalls = 0;
    let refreshCalls = 0;

    server.use(
      http.get(`${API}/bookings`, () => {
        bookingsCalls += 1;
        return HttpResponse.json(
          { status: "error", message: "Invalid credentials", code: "INVALID_CREDENTIALS" },
          { status: 401 }
        );
      }),
      http.post(`${API}/auth/refresh-token`, () => {
        refreshCalls += 1;
        return HttpResponse.json(refreshOk);
      })
    );

    const store = makeStore();
    const result = await store.dispatch(
      bookingApi.endpoints.getAllBookings.initiate({})
    );

    expect(result.error).toMatchObject({ status: 401 });
    expect(refreshCalls).toBe(0);
    expect(bookingsCalls).toBe(1);
  });

  it("dedupes concurrent 401s into a single refresh (mutex)", async () => {
    let bookingsCalls = 0;
    let paymentsCalls = 0;
    let refreshCalls = 0;

    server.use(
      http.get(`${API}/bookings`, () => {
        bookingsCalls += 1;
        if (bookingsCalls === 1) {
          return HttpResponse.json(
            { status: "error", message: "expired", code: "EXPIRED_TOKEN" },
            { status: 401 }
          );
        }
        return HttpResponse.json(bookingsPage);
      }),
      http.get(`${API}/payments`, () => {
        paymentsCalls += 1;
        if (paymentsCalls === 1) {
          return HttpResponse.json(
            { status: "error", message: "expired", code: "EXPIRED_TOKEN" },
            { status: 401 }
          );
        }
        return HttpResponse.json(paymentsPage);
      }),
      http.post(`${API}/auth/refresh-token`, async () => {
        refreshCalls += 1;
        // Slow refresh: both 401s must land while the first holds the mutex.
        await delay(80);
        return HttpResponse.json(refreshOk);
      })
    );

    const store = makeStore();
    const [bookings, payments] = await Promise.all([
      store.dispatch(bookingApi.endpoints.getAllBookings.initiate({})),
      store.dispatch(paymentApi.endpoints.getAllPayments.initiate({})),
    ]);

    expect(bookings.data).toEqual(bookingsPage);
    expect(payments.data).toEqual(paymentsPage);
    expect(refreshCalls).toBe(1);
  });

  it("logs out when the refresh itself fails", async () => {
    server.use(
      http.get(`${API}/bookings`, () =>
        HttpResponse.json(
          { status: "error", message: "expired", code: "EXPIRED_TOKEN" },
          { status: 401 }
        )
      ),
      http.post(`${API}/auth/refresh-token`, () =>
        HttpResponse.json(
          { status: "error", message: "Session expired." },
          { status: 401 }
        )
      )
    );

    const store = makeStore();
    const result = await store.dispatch(
      bookingApi.endpoints.getAllBookings.initiate({})
    );

    expect(result.error).toMatchObject({ status: 401 });
    expect(store.getState().auth.user).toBeNull();
  });
});

describe("cache tag invalidation", () => {
  it("cancelBooking refetches the bookings AND payments lists (refund side-effect)", async () => {
    let bookingsCalls = 0;
    let paymentsCalls = 0;

    server.use(
      http.get(`${API}/bookings`, () => {
        bookingsCalls += 1;
        return HttpResponse.json(bookingsPage);
      }),
      http.get(`${API}/payments`, () => {
        paymentsCalls += 1;
        return HttpResponse.json(paymentsPage);
      }),
      http.post(`${API}/bookings/1/cancel`, () =>
        HttpResponse.json({ message: "Booking cancelled", data: { id: 1 } })
      )
    );

    const store = makeStore();

    // Active subscriptions, as mounted components would hold.
    const bookingsSub = store.dispatch(
      bookingApi.endpoints.getAllBookings.initiate({})
    );
    const paymentsSub = store.dispatch(
      paymentApi.endpoints.getAllPayments.initiate({})
    );
    await Promise.all([bookingsSub, paymentsSub]);
    expect(bookingsCalls).toBe(1);
    expect(paymentsCalls).toBe(1);

    await store.dispatch(bookingApi.endpoints.cancelBooking.initiate(1));

    // Invalidation refetches both subscribed lists.
    await vi.waitFor(() => {
      expect(bookingsCalls).toBe(2);
      expect(paymentsCalls).toBe(2);
    });

    bookingsSub.unsubscribe();
    paymentsSub.unsubscribe();
  });
});
