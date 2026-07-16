// test/integration/reports.test.ts
//
// Reports + dashboard endpoints, pinned against the service-layer refactor:
// the aggregate keys and math the frontend dashboards read (summaries,
// monthly/status/method breakdowns, top-N capping and ordering, the
// period/filters echoes), the ADMIN-only route gates, and the zod filter
// 400s. Rows are seeded directly through Prisma so booking/payment dates are
// deterministic; mid-month UTC noon instants keep the server-local month
// windows unambiguous in any timezone.
import { describe, expect, it } from 'vitest';

import prisma, {
  BookingStatus,
  PaymentMethod,
  PaymentStatus,
} from '#config/prismaClient.js';

import { api, authedApi } from '../helpers/auth.js';
import {
  createAdmin,
  createFlight,
  createHotel,
  createRoom,
  createTour,
  createUser,
} from '../helpers/factories.js';

/** One booking per (user, tour) — the schema enforces that pair unique. */
const createBooking = async (input: {
  bookingDate: string;
  status?: BookingStatus;
  totalPrice: number;
  tourId: number;
  userId: number;
}) =>
  prisma.booking.create({
    data: {
      bookingDate: new Date(input.bookingDate),
      status: input.status ?? BookingStatus.PENDING,
      totalPrice: input.totalPrice,
      tourId: input.tourId,
      userId: input.userId,
    },
  });

/** Three bookings on one tour: two in March 2026, one in April 2026. */
const seedBookingScenario = async () => {
  const tour = await createTour();
  const [u1, u2, u3] = await Promise.all([
    createUser(),
    createUser(),
    createUser(),
  ]);

  const march1 = await createBooking({
    bookingDate: '2026-03-10T12:00:00Z',
    status: BookingStatus.CONFIRMED,
    totalPrice: 500,
    tourId: tour.id,
    userId: u1.id,
  });
  const march2 = await createBooking({
    bookingDate: '2026-03-20T12:00:00Z',
    status: BookingStatus.PENDING,
    totalPrice: 300,
    tourId: tour.id,
    userId: u2.id,
  });
  const april = await createBooking({
    bookingDate: '2026-04-05T12:00:00Z',
    status: BookingStatus.CONFIRMED,
    totalPrice: 200,
    tourId: tour.id,
    userId: u3.id,
  });

  return { april, march1, march2, tour };
};

describe('GET /api/v1/reports/bookings/monthly-summary', () => {
  it('aggregates totals, monthly buckets and the status breakdown for a year', async () => {
    const admin = await createAdmin();
    await seedBookingScenario();

    const res = await authedApi(admin).get(
      '/api/v1/reports/bookings/monthly-summary?year=2026',
    );

    expect(res.status).toBe(200);
    expect(res.body.message).toBe(
      'Monthly bookings summary retrieved successfully',
    );

    const { bookings, monthlyBreakdown, statusBreakdown, summary } =
      res.body.data;

    expect(summary.totalBookings).toBe(3);
    expect(summary.totalRevenue).toBe(1000);
    // 1000 / 3, rounded to 2dp like the legacy Math.round(x * 100) / 100.
    expect(summary.averageBookingValue).toBe(333.33);
    // No explicit range sent: startDate/endDate keys are absent, month null.
    expect(summary.period).toEqual({ month: null, year: 2026 });

    expect(monthlyBreakdown).toHaveLength(2);
    expect(monthlyBreakdown).toEqual(
      expect.arrayContaining([
        {
          averageValue: 400,
          bookingCount: 2,
          month: '2026-03',
          revenue: 800,
        },
        {
          averageValue: 200,
          bookingCount: 1,
          month: '2026-04',
          revenue: 200,
        },
      ]),
    );

    expect(statusBreakdown).toEqual({ CONFIRMED: 2, PENDING: 1 });

    expect(bookings).toHaveLength(3);
    expect(bookings[0]).toMatchObject({
      tour: { name: expect.any(String) },
      user: { email: expect.any(String) },
    });
  });

  it('filters by year + month', async () => {
    const admin = await createAdmin();
    await seedBookingScenario();

    const res = await authedApi(admin).get(
      '/api/v1/reports/bookings/monthly-summary?year=2026&month=3',
    );

    expect(res.status).toBe(200);
    expect(res.body.data.summary.totalBookings).toBe(2);
    expect(res.body.data.summary.totalRevenue).toBe(800);
    expect(res.body.data.summary.period.month).toBe(3);
  });

  it('filters by an explicit date range and echoes it in the period', async () => {
    const admin = await createAdmin();
    await seedBookingScenario();

    const res = await authedApi(admin).get(
      '/api/v1/reports/bookings/monthly-summary?startDate=2026-04-01&endDate=2026-04-30',
    );

    expect(res.status).toBe(200);
    expect(res.body.data.summary.totalBookings).toBe(1);
    expect(res.body.data.summary.period).toEqual({
      endDate: '2026-04-30',
      month: null,
      startDate: '2026-04-01',
      year: expect.any(Number),
    });
  });

  it('filters by booking status', async () => {
    const admin = await createAdmin();
    await seedBookingScenario();

    const res = await authedApi(admin).get(
      '/api/v1/reports/bookings/monthly-summary?year=2026&status=CONFIRMED',
    );

    expect(res.status).toBe(200);
    expect(res.body.data.summary.totalBookings).toBe(2);
    expect(res.body.data.statusBreakdown).toEqual({ CONFIRMED: 2 });
  });

  it.each([
    ['month out of range', 'month=13'],
    ['invalid status', 'status=BOGUS'],
    ['year below 2020', 'year=2019'],
    ['malformed startDate', 'startDate=not-a-date'],
  ])('rejects %s with 400', async (_label, queryString) => {
    const admin = await createAdmin();

    const res = await authedApi(admin).get(
      `/api/v1/reports/bookings/monthly-summary?${queryString}`,
    );

    expect(res.status).toBe(400);
  });

  it('is forbidden for customers', async () => {
    const customer = await createUser();

    const res = await authedApi(customer).get(
      '/api/v1/reports/bookings/monthly-summary?year=2026',
    );

    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/reports/payments/summary', () => {
  /** Three payments: COMPLETED + PENDING in March 2026, FAILED in April. */
  const seedPaymentScenario = async () => {
    const rows = [
      {
        amount: 500,
        method: PaymentMethod.CREDIT_CARD,
        paymentDate: '2026-03-15T12:00:00Z',
        status: PaymentStatus.COMPLETED,
      },
      {
        amount: 300,
        method: PaymentMethod.MOBILE_MONEY,
        paymentDate: '2026-03-18T12:00:00Z',
        status: PaymentStatus.PENDING,
      },
      {
        amount: 200,
        method: PaymentMethod.CREDIT_CARD,
        paymentDate: '2026-04-10T12:00:00Z',
        status: PaymentStatus.FAILED,
      },
    ];

    const payments = [];
    for (const row of rows) {
      const user = await createUser();
      const tour = await createTour();
      const booking = await createBooking({
        bookingDate: row.paymentDate,
        totalPrice: row.amount,
        tourId: tour.id,
        userId: user.id,
      });
      payments.push(
        await prisma.payment.create({
          data: {
            amount: row.amount,
            bookingId: booking.id,
            paymentDate: new Date(row.paymentDate),
            paymentMethod: row.method,
            status: row.status,
            transactionReference: `reports-ref-${String(booking.id)}`,
            userId: user.id,
          },
        }),
      );
    }
    return payments;
  };

  it('aggregates revenue by status, method and month for a year', async () => {
    const admin = await createAdmin();
    const [, , failedApril] = await seedPaymentScenario();

    const res = await authedApi(admin).get(
      '/api/v1/reports/payments/summary?year=2026',
    );

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Payments summary retrieved successfully');

    const { methodBreakdown, monthlyBreakdown, recentPayments, statusBreakdown, summary } =
      res.body.data;

    expect(summary).toMatchObject({
      currency: 'GHS',
      failedAmount: 200,
      pendingAmount: 300,
      refundedAmount: 0,
      totalPayments: 3,
      // Only COMPLETED payments count as revenue.
      totalRevenue: 500,
    });
    expect(summary.period).toEqual({ month: null, year: 2026 });

    expect(statusBreakdown).toEqual({
      COMPLETED: { amount: 500, count: 1 },
      FAILED: { amount: 200, count: 1 },
      PENDING: { amount: 300, count: 1 },
    });
    expect(methodBreakdown).toEqual({
      CREDIT_CARD: { amount: 700, count: 2 },
      MOBILE_MONEY: { amount: 300, count: 1 },
    });
    expect(monthlyBreakdown).toEqual(
      expect.arrayContaining([
        { count: 2, month: '2026-03', revenue: 500 },
        { count: 1, month: '2026-04', revenue: 0 },
      ]),
    );

    // Most recent paymentDate first.
    expect(recentPayments).toHaveLength(3);
    expect(recentPayments[0].id).toBe(failedApril.id);
    expect(recentPayments[0].booking.tour).toMatchObject({
      name: expect.any(String),
    });
  });

  it('filters by payment method', async () => {
    const admin = await createAdmin();
    await seedPaymentScenario();

    const res = await authedApi(admin).get(
      '/api/v1/reports/payments/summary?year=2026&paymentMethod=CREDIT_CARD',
    );

    expect(res.status).toBe(200);
    expect(res.body.data.summary.totalPayments).toBe(2);
    expect(res.body.data.methodBreakdown).toEqual({
      CREDIT_CARD: { amount: 700, count: 2 },
    });
  });

  it.each([
    ['invalid payment method', 'paymentMethod=CASH'],
    ['invalid payment status', 'status=BOGUS'],
    ['non-3-letter currency', 'currency=GHSS'],
  ])('rejects %s with 400', async (_label, queryString) => {
    const admin = await createAdmin();

    const res = await authedApi(admin).get(
      `/api/v1/reports/payments/summary?${queryString}`,
    );

    expect(res.status).toBe(400);
  });

  it('is forbidden for customers', async () => {
    const customer = await createUser();

    const res = await authedApi(customer).get(
      '/api/v1/reports/payments/summary?year=2026',
    );

    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/reports/tours/top-by-bookings', () => {
  /** t1: 3 bookings (2 CONFIRMED, 1 PENDING), t2: 1, t3: none. */
  const seedTopToursScenario = async () => {
    const [t1, t2, t3] = [
      await createTour(),
      await createTour(),
      await createTour(),
    ];

    const users = await Promise.all([
      createUser(),
      createUser(),
      createUser(),
      createUser(),
    ]);

    await createBooking({
      bookingDate: '2026-05-15T12:00:00Z',
      status: BookingStatus.CONFIRMED,
      totalPrice: 400,
      tourId: t1.id,
      userId: users[0].id,
    });
    await createBooking({
      bookingDate: '2026-05-16T12:00:00Z',
      status: BookingStatus.CONFIRMED,
      totalPrice: 400,
      tourId: t1.id,
      userId: users[1].id,
    });
    await createBooking({
      bookingDate: '2026-05-17T12:00:00Z',
      status: BookingStatus.PENDING,
      totalPrice: 200,
      tourId: t1.id,
      userId: users[2].id,
    });
    await createBooking({
      bookingDate: '2026-05-18T12:00:00Z',
      status: BookingStatus.CONFIRMED,
      totalPrice: 300,
      tourId: t2.id,
      userId: users[3].id,
    });

    return { t1, t2, t3 };
  };

  it('ranks tours by booking count with per-tour statistics and totals', async () => {
    const admin = await createAdmin();
    const { t1, t2 } = await seedTopToursScenario();

    const res = await authedApi(admin).get(
      '/api/v1/reports/tours/top-by-bookings?year=2026',
    );

    expect(res.status).toBe(200);
    expect(res.body.message).toBe(
      'Top 2 tours by booking count retrieved successfully',
    );

    const { summary, topTours } = res.body.data;

    // t3 has no bookings and the default minBookings is 1.
    expect(topTours).toHaveLength(2);
    expect(topTours[0].tour.id).toBe(t1.id);
    expect(topTours[0].statistics).toEqual({
      confirmedBookings: 2,
      totalBookings: 3,
      totalRevenue: 1000,
    });
    expect(topTours[0].tour.destination).toMatchObject({
      city: expect.any(String),
      country: expect.any(String),
      name: expect.any(String),
    });
    expect(topTours[1].tour.id).toBe(t2.id);

    // No tourType/tourStatus sent: their keys are absent from the echo.
    expect(summary.filters).toEqual({ limit: 5, minBookings: 1 });
    expect(summary.period).toEqual({ month: null, year: 2026 });
    expect(summary.totalToursAnalyzed).toBe(3);
    expect(summary.totalBookingsAnalyzed).toBe(4);
    expect(summary.totalRevenueAnalyzed).toBe(1300);
  });

  it('honours minBookings and the limit cap', async () => {
    const admin = await createAdmin();
    const { t1 } = await seedTopToursScenario();

    const byMin = await authedApi(admin).get(
      '/api/v1/reports/tours/top-by-bookings?year=2026&minBookings=2',
    );
    expect(byMin.status).toBe(200);
    expect(byMin.body.data.topTours).toHaveLength(1);
    expect(byMin.body.data.topTours[0].tour.id).toBe(t1.id);
    expect(byMin.body.data.summary.filters.minBookings).toBe(2);

    const byLimit = await authedApi(admin).get(
      '/api/v1/reports/tours/top-by-bookings?year=2026&limit=1',
    );
    expect(byLimit.status).toBe(200);
    expect(byLimit.body.data.topTours).toHaveLength(1);
    expect(byLimit.body.data.topTours[0].tour.id).toBe(t1.id);
    expect(byLimit.body.data.summary.filters.limit).toBe(1);
    // The limit caps the list, not the analysis totals.
    expect(byLimit.body.data.summary.totalToursAnalyzed).toBe(3);
  });

  it('applies the tour type filter to the analyzed set', async () => {
    const admin = await createAdmin();
    await seedTopToursScenario(); // factory tours are all ADVENTURE

    const res = await authedApi(admin).get(
      '/api/v1/reports/tours/top-by-bookings?year=2026&tourType=CRUISE',
    );

    expect(res.status).toBe(200);
    expect(res.body.data.topTours).toEqual([]);
    expect(res.body.data.summary.totalToursAnalyzed).toBe(0);
    expect(res.body.message).toBe(
      'Top 0 tours by booking count retrieved successfully',
    );
  });

  it.each([
    ['limit above 20', 'limit=50'],
    ['invalid tour type', 'tourType=SAFARI'],
    ['invalid tour status', 'tourStatus=BOGUS'],
    ['negative minBookings', 'minBookings=-1'],
  ])('rejects %s with 400', async (_label, queryString) => {
    const admin = await createAdmin();

    const res = await authedApi(admin).get(
      `/api/v1/reports/tours/top-by-bookings?${queryString}`,
    );

    expect(res.status).toBe(400);
  });

  it('is forbidden for customers', async () => {
    const customer = await createUser();

    const res = await authedApi(customer).get(
      '/api/v1/reports/tours/top-by-bookings?year=2026',
    );

    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/dashboard', () => {
  /** 1 tour, 1 hotel + room, 1 flight, 1 confirmed booking, 4 destinations. */
  const seedDashboardScenario = async (customerId: number) => {
    const tour = await createTour(); // +1 destination
    const hotel = await createHotel(); // +1 destination
    await createRoom({ hotelId: hotel.id });
    await createFlight({ capacity: 120 }); // +2 destinations
    await createBooking({
      bookingDate: '2026-06-10T12:00:00Z',
      status: BookingStatus.CONFIRMED,
      totalPrice: 500,
      tourId: tour.id,
      userId: customerId,
    });
  };

  it('returns the base inventory stats to a customer, without bookings/users', async () => {
    const customer = await createUser();
    await seedDashboardScenario(customer.id);

    const res = await authedApi(customer).get('/api/v1/dashboard');

    expect(res.status).toBe(200);
    expect(res.body.message).toBe(
      'Dashboard statistics retrieved successfully',
    );
    expect(res.body.data).toEqual({
      destinations: { total: 4 },
      flights: { availableSeats: 120, total: 1 },
      hotels: { availableRooms: 1, total: 1 },
      tours: { ongoing: 0, total: 1, upcoming: 1 },
    });
  });

  it('adds booking and user stats for an admin', async () => {
    const admin = await createAdmin();
    const customer = await createUser();
    await seedDashboardScenario(customer.id);

    const res = await authedApi(admin).get('/api/v1/dashboard');

    expect(res.status).toBe(200);
    expect(res.body.data.bookings).toEqual({
      completed: 0,
      confirmed: 1,
      pending: 0,
      total: 1,
    });
    expect(res.body.data.users).toEqual({
      admins: 1,
      agents: 0,
      customers: 1,
      total: 2,
    });
  });

  it('requires authentication', async () => {
    const res = await api().get('/api/v1/dashboard');

    expect(res.status).toBe(401);
  });
});
