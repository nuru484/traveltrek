import { defaultDeps } from '#services/deps.js';
// src/services/report.service.ts
//
// Thin composer for the reports domain. The implementation is split into
// modules under ./report: shared.ts (Prisma selects, wire-payload types, the
// pure period-window/trend helpers), core.ts (report-year resolution), and one
// module per report (bookings, payments, tours, and the per-actor self
// reports). makeReportService builds the core once and spreads each feature
// factory into one object, preserving the public surface.
import { makeReportBookingsService } from '#services/report/bookings.service.js';
import { makeReportCore } from '#services/report/core.js';
import { makeReportPaymentsService } from '#services/report/payments.service.js';
import { makeReportSelfService } from '#services/report/self.service.js';
import {
  type AgentActivityParams,
  type AgentActivityReport,
  type AmountCountBucket,
  type BookingMonthBucket,
  type CustomerSelfReport,
  type MonthlyBookingRow,
  type MonthlyBookingsParams,
  type MonthlyBookingsReport,
  type PaymentMonthBucket,
  type PaymentsSummaryParams,
  type PaymentsSummaryReport,
  type PaymentSummaryRow,
  type ReportDeps,
  type ReportPeriod,
  type ReportPeriodParams,
  type ReportTrend,
  type TopToursParams,
  type TopToursReport,
  type TourTopStats,
} from '#services/report/shared.js';
import { makeReportToursService } from '#services/report/tours.service.js';

// Re-export the public types controllers/tests import from this module path.
export {
  type AgentActivityParams,
  type AgentActivityReport,
  type AmountCountBucket,
  type BookingMonthBucket,
  type CustomerSelfReport,
  type MonthlyBookingRow,
  type MonthlyBookingsParams,
  type MonthlyBookingsReport,
  type PaymentMonthBucket,
  type PaymentsSummaryParams,
  type PaymentsSummaryReport,
  type PaymentSummaryRow,
  type ReportPeriod,
  type ReportPeriodParams,
  type ReportTrend,
  type TopToursParams,
  type TopToursReport,
  type TourTopStats,
};

export const makeReportService = (d: ReportDeps) => {
  const core = makeReportCore(d);
  return {
    ...makeReportBookingsService(d, core),
    ...makeReportPaymentsService(d, core),
    ...makeReportToursService(d, core),
    ...makeReportSelfService(d, core),
  };
};

export const reportService = makeReportService(defaultDeps);

export const {
  getAgentActivity,
  getCustomerSelfReport,
  getMonthlyBookingsSummary,
  getPaymentsSummary,
  getTopToursByBookings,
} = reportService;
