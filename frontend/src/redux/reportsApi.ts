// src/redux/reportsApi.ts
import { apiSlice } from "./apiSlice";
import {
  IAgentActivityResponse,
  ICustomerSelfReportResponse,
  IMonthlyBookingsResponse,
  IPaymentsSummaryResponse,
  ITopToursResponse,
  IReportsQueryParams,
} from "@/types/reports.types";

/** Typed query-string builder shared by every reports endpoint. */
const buildReportsUrl = (path: string, params: IReportsQueryParams): string => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.append(key, String(value));
    }
  });

  const queryString = searchParams.toString();
  return `${path}${queryString ? `?${queryString}` : ""}`;
};

// Each widget owns its own query against one of these three endpoints, so
// KPIs, charts and lists load/error/empty independently (no combined
// all-or-nothing overview query).
export const reportsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getMonthlyBookingsSummary: builder.query<
      IMonthlyBookingsResponse,
      IReportsQueryParams
    >({
      query: (params = {}) => ({
        url: buildReportsUrl("/reports/bookings/monthly-summary", params),
        method: "GET",
      }),
      providesTags: ["BookingsReport"],
    }),

    getPaymentsSummary: builder.query<
      IPaymentsSummaryResponse,
      IReportsQueryParams
    >({
      query: (params = {}) => ({
        url: buildReportsUrl("/reports/payments/summary", params),
        method: "GET",
      }),
      providesTags: ["PaymentsReport"],
    }),

    // CUSTOMER-only self report (period params only).
    getMyReport: builder.query<
      ICustomerSelfReportResponse,
      IReportsQueryParams
    >({
      query: (params = {}) => ({
        url: buildReportsUrl("/reports/me", params),
        method: "GET",
      }),
      providesTags: ["MyReport"],
    }),

    // Staff activity report; agents self-only, ADMIN may pass ?userId=.
    getAgentActivity: builder.query<
      IAgentActivityResponse,
      IReportsQueryParams & { userId?: number }
    >({
      query: (params = {}) => ({
        url: buildReportsUrl("/reports/agent-activity", params),
        method: "GET",
      }),
      providesTags: ["AgentActivity"],
    }),

    getTopToursByBookings: builder.query<
      ITopToursResponse,
      IReportsQueryParams
    >({
      query: (params = {}) => ({
        url: buildReportsUrl("/reports/tours/top-by-bookings", params),
        method: "GET",
      }),
      providesTags: ["ToursReport"],
    }),
  }),
});

export const {
  useGetMonthlyBookingsSummaryQuery,
  useGetPaymentsSummaryQuery,
  useGetTopToursByBookingsQuery,
  useGetMyReportQuery,
  useGetAgentActivityQuery,

  // Lazy hooks
  useLazyGetMonthlyBookingsSummaryQuery,
  useLazyGetPaymentsSummaryQuery,
  useLazyGetTopToursByBookingsQuery,
} = reportsApi;
