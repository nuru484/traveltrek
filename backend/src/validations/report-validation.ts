// src/validations/report-validation.ts
//
// Zod schemas for the reports domain (replaces the express-validator chains
// in the legacy reports-validations.ts). Boundary rules only — shape, ranges,
// enums — with the legacy messages kept field-for-field:
//
// - year is bounded 2020–2030 and month 1–12, both optional; the "default to
//   the current year" rule stays in the report service (via the injected
//   clock), matching the legacy destructure default.
// - startDate/endDate accept any ISO 8601 date or datetime, like the legacy
//   isISO8601() check. The strings pass through unparsed: the service both
//   builds the Prisma window from them and echoes them verbatim in
//   `summary.period`, exactly as before.
// - limit (1–20, default 5) and minBookings (>= 0, default 1) move their
//   handler-side destructure defaults here; the wire echo in
//   `summary.filters` is unchanged.
import { z } from 'zod';

import {
  BookingStatus,
  PaymentMethod,
  PaymentStatus,
  TourStatus,
  TourType,
} from '#config/prismaClient.js';

/** ISO 8601 date ("2026-03-01") or datetime, like validator.js isISO8601. */
const isoDateQuery = (message: string) =>
  z
    .union(
      [z.iso.date(), z.iso.datetime({ local: true, offset: true })],
      message,
    )
    .optional();

const monthQuery = z.coerce
  .number('Month must be between 1 and 12')
  .int('Month must be between 1 and 12')
  .min(1, 'Month must be between 1 and 12')
  .max(12, 'Month must be between 1 and 12')
  .optional();

const positiveIntQuery = (message: string) =>
  z.coerce.number(message).int(message).min(1, message).optional();

const yearQuery = z.coerce
  .number('Year must be between 2020 and 2030')
  .int('Year must be between 2020 and 2030')
  .min(2020, 'Year must be between 2020 and 2030')
  .max(2030, 'Year must be between 2020 and 2030')
  .optional();

/** GET /reports/bookings/monthly-summary */
export const monthlyBookingsQuery = z.object({
  customerId: positiveIntQuery('Customer ID must be a positive integer'),
  endDate: isoDateQuery('End date must be a valid ISO 8601 date'),
  month: monthQuery,
  startDate: isoDateQuery('Start date must be a valid ISO 8601 date'),
  status: z.enum(BookingStatus, 'Invalid booking status').optional(),
  tourId: positiveIntQuery('Tour ID must be a positive integer'),
  year: yearQuery,
});

/** GET /reports/payments/summary */
export const paymentsSummaryQuery = z.object({
  currency: z
    .string('Currency must be a 3-letter code')
    .length(3, 'Currency must be a 3-letter code')
    .default('GHS'),
  customerId: positiveIntQuery('Customer ID must be a positive integer'),
  endDate: isoDateQuery('End date must be a valid ISO 8601 date'),
  month: monthQuery,
  paymentMethod: z.enum(PaymentMethod, 'Invalid payment method').optional(),
  startDate: isoDateQuery('Start date must be a valid ISO 8601 date'),
  status: z.enum(PaymentStatus, 'Invalid payment status').optional(),
  year: yearQuery,
});

/** GET /reports/tours/top-by-bookings */
export const topToursQuery = z.object({
  endDate: isoDateQuery('End date must be a valid ISO 8601 date'),
  limit: z.coerce
    .number('Limit must be between 1 and 20')
    .int('Limit must be between 1 and 20')
    .min(1, 'Limit must be between 1 and 20')
    .max(20, 'Limit must be between 1 and 20')
    .default(5),
  minBookings: z.coerce
    .number('Minimum bookings must be non-negative')
    .int('Minimum bookings must be non-negative')
    .min(0, 'Minimum bookings must be non-negative')
    .default(1),
  month: monthQuery,
  startDate: isoDateQuery('Start date must be a valid ISO 8601 date'),
  tourStatus: z.enum(TourStatus, 'Invalid tour status').optional(),
  tourType: z.enum(TourType, 'Invalid tour type').optional(),
  year: yearQuery,
});

export type MonthlyBookingsQueryInput = z.infer<typeof monthlyBookingsQuery>;
export type PaymentsSummaryQueryInput = z.infer<typeof paymentsSummaryQuery>;
export type TopToursQueryInput = z.infer<typeof topToursQuery>;
