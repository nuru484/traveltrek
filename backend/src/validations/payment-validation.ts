// src/validations/payment-validation.ts
//
// Zod schemas for the payment domain. Boundary rules only: shape, formats,
// enums. They are deliberately conservative so the response contract stays
// what the service defines:
//
// - createPayment: paymentMethod stays an optional string here because the
//   method check must run AFTER the booking guards, with its own 400
//   ('Invalid payment method'); that check (and its ordering) lives in
//   services/payment.service.ts.
// - updatePaymentStatus: status stays an optional string for the same reason
//   (the 401 admin gate must answer before the 400 'Invalid payment status').
// - GET /payments/customer/:customerId silently IGNORES invalid
//   status/paymentMethod filters instead of rejecting them;
//   `.catch(undefined)` is what drops them.
import { z } from 'zod';

import { PaymentMethod, PaymentStatus } from '#config/prismaClient.js';
import { paginationQuery } from '#validations/common-validation.js';

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

/** List filters for GET /payments (admin customerId override in service). */
export const paymentListQuery = paginationQuery.extend({
  customerId: z.coerce.number().int().min(1).optional(),
  paymentMethod: z.enum(PaymentMethod, 'Invalid payment method').optional(),
  search: z.string().optional(),
  status: z.enum(PaymentStatus, 'Invalid payment status').optional(),
});

/**
 * List filters for GET /payments/customer/:customerId: invalid enum values
 * fall back to undefined and are ignored rather than rejected.
 */
export const customerPaymentsQuery = paginationQuery.extend({
  paymentMethod: z.enum(PaymentMethod).optional().catch(undefined),
  status: z.enum(PaymentStatus).optional().catch(undefined),
});

export type CreatePaymentBody = z.infer<typeof createPaymentSchema>;
export type CustomerPaymentsQueryInput = z.infer<typeof customerPaymentsQuery>;
export type PaymentListQueryInput = z.infer<typeof paymentListQuery>;
export type RefundPaymentBody = z.infer<typeof refundPaymentSchema>;
export type UpdatePaymentStatusBody = z.infer<
  typeof updatePaymentStatusSchema
>;
