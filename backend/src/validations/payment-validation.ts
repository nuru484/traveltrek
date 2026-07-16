// src/validations/payment-validation.ts
//
// Zod schemas for the payment domain. Boundary rules only — shape, formats,
// enums. The legacy fat controller validated almost nothing at the boundary
// (bookingId went straight into Prisma), so these schemas are deliberately
// conservative to preserve the legacy contract:
//
// - createPayment: paymentMethod stays an optional string here because the
//   legacy handler checked it AFTER the booking guards, with its own 400
//   ('Invalid payment method') — that check (and its ordering) lives in
//   services/payment.service.ts.
// - updatePaymentStatus: status stays an optional string for the same reason
//   (the legacy 401 admin gate ran before the 400 'Invalid payment status').
// - GET /payments/user/:userId silently IGNORED invalid status/paymentMethod
//   filters instead of rejecting them; `.catch(undefined)` preserves that.
import { z } from 'zod';

import { PaymentMethod, PaymentStatus } from '../config/prismaClient';
import { paginationQuery } from './common-validation';

/** POST /payments — the method enum is enforced in the service (see above). */
export const createPaymentSchema = z.object({
  bookingId: z.coerce
    .number('A valid bookingId is required')
    .int('A valid bookingId is required')
    .positive('A valid bookingId is required'),
  paymentMethod: z.string('paymentMethod must be a string').optional(),
});

/** PATCH /payments/:id — the status enum is enforced in the service. */
export const updatePaymentStatusSchema = z.object({
  status: z.string('Invalid payment status').optional(),
});

/** PATCH /payments/:id/refund — reason was always optional free text. */
export const refundPaymentSchema = z.object({
  reason: z.string('reason must be a string').optional(),
});

/** List filters for GET /payments (admin userId override applied in service). */
export const paymentListQuery = paginationQuery.extend({
  paymentMethod: z.enum(PaymentMethod, 'Invalid payment method').optional(),
  search: z.string().optional(),
  status: z.enum(PaymentStatus, 'Invalid payment status').optional(),
  userId: z.coerce.number().int().min(1).optional(),
});

/**
 * List filters for GET /payments/user/:userId — invalid enum values fall back
 * to undefined (ignored), exactly as the legacy includes-check did.
 */
export const userPaymentsQuery = paginationQuery.extend({
  paymentMethod: z.enum(PaymentMethod).optional().catch(undefined),
  status: z.enum(PaymentStatus).optional().catch(undefined),
});

export type CreatePaymentBody = z.infer<typeof createPaymentSchema>;
export type PaymentListQueryInput = z.infer<typeof paymentListQuery>;
export type RefundPaymentBody = z.infer<typeof refundPaymentSchema>;
export type UpdatePaymentStatusBody = z.infer<
  typeof updatePaymentStatusSchema
>;
export type UserPaymentsQueryInput = z.infer<typeof userPaymentsQuery>;
