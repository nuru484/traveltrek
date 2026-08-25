// src/services/payment/shared.ts
//
// Dependency-free building blocks for the payments domain: the accepted
// method/status whitelists, the request/result types, the type guards, and
// the Paystack channel mapping. Shared by the payment core and every feature
// module.
import {
  type BookingStatus,
  type PaymentMethod,
  type PaymentStatus,
} from '#config/prismaClient.js';
import { type AppDeps } from '#services/deps.js';
import { type IUser } from '#types/user-profile.types.js';
import { type PaymentWithRelations } from '#utils/mappers/payment.mapper.js';

/** The deps the payments domain draws from the app container. */
export type PaymentDeps = Pick<
  AppDeps,
  'clock' | 'config' | 'logger' | 'notify' | 'paystack' | 'prisma'
>;

/** Payment methods the API accepts (mirrors PaymentMethod). */
export const PAYMENT_METHODS = [
  'BANK_TRANSFER',
  'CREDIT_CARD',
  'DEBIT_CARD',
  'MOBILE_MONEY',
] as const;

/** Statuses updatePaymentStatus accepts — the manual/admin subset of
 * PaymentStatus. REFUND_REQUESTED is deliberately absent: it is only ever set
 * by the customer self-cancel flow and leaves via the refund endpoint. */
export const PAYMENT_STATUSES = [
  'COMPLETED',
  'FAILED',
  'PENDING',
  'REFUNDED',
] as const;

export type PaymentActor = Pick<IUser, 'id' | 'role'>;

/**
 * Outcome of the GET /payments/callback verification. `no_booking_id` and
 * `booking_not_found` are the early-return responses (400/404); the remaining
 * kinds are the three 200 bodies (failed / mismatch / completed).
 */
export type PaymentCallbackResult =
  | {
      amount: number;
      bookingId: number;
      kind: 'amount_mismatch' | 'completed' | 'not_successful';
      reference: string;
    }
  | { kind: 'booking_not_found' }
  | { kind: 'no_booking_id' };

export interface PaymentDeleteSummary {
  bookingId: number;
  paymentId: number;
}

export interface PaymentInitializeInput {
  bookingId: number;
  /** Validated against PAYMENT_METHODS here, after the booking gates. */
  paymentMethod?: string;
}

export interface PaymentInitializeResult {
  authorizationUrl: string;
  paymentId: number;
  /** True when an existing PENDING payment was re-initialized. */
  resumed: boolean;
  transactionReference: string;
}

export interface PaymentListParams {
  /** Filter by owner; honoured for ADMIN only. */
  customerId?: number;
  limit: number;
  page: number;
  paymentMethod?: PaymentMethod;
  search?: string;
  status?: PaymentStatus;
}

/** What one reconciliation tick changed; every count is of ledger rows. */
export interface PaymentReconciliationSummary {
  /** Bookings cancelled to catch up with a payment already REFUNDED. */
  bookingsCancelled: number;
  /** PENDING charges Paystack reports as terminal, now FAILED. */
  chargesClosed: number;
  /** Settled charges neither the webhook nor the callback confirmed. */
  chargesRecovered: number;
  /** Dashboard-side refunds the ledger had missed. */
  providerRefundsApplied: number;
  /** REFUNDED claims Paystack never received, re-issued. */
  refundsReissued: number;
}

export interface PaymentRefundSummary {
  bookingStatus: BookingStatus;
  payment: PaymentWithRelations;
  /** Paystack's id for the refund, when it was issued by this call. Null
   * when Paystack already held a refund for the charge. */
  paystackRefundId: null | number;
  reason: string;
  refundAmount: number;
}

export interface PaymentStatusUpdateSummary {
  bookingStatus: BookingStatus;
  payment: PaymentWithRelations;
}

/** Outcome of processing one signature-verified webhook event. */
export type PaymentWebhookOutcome =
  | 'confirmed'
  | 'ignored'
  | 'refund_applied';

/** The subset of a Paystack webhook body the handled events read. Refund
 * events carry the charge under `transaction_reference` (and `reference` is
 * the refund's own); charge events carry it under `reference`. */
export interface PaystackWebhookEvent {
  data?: {
    /** On refund events: the refunded amount in minor units. */
    amount?: number;
    id?: number;
    metadata?: { bookingId?: number | string };
    reference?: string;
    transaction_reference?: string;
  };
  event?: string;
}

export const isPaymentMethod = (
  value: string | undefined,
): value is PaymentMethod =>
  value !== undefined &&
  (PAYMENT_METHODS as readonly string[]).includes(value);

export const isPaymentStatus = (
  value: string | undefined,
): value is PaymentStatus =>
  value !== undefined &&
  (PAYMENT_STATUSES as readonly string[]).includes(value);

/** Paystack channel for a validated payment method. */
export const getPaystackChannel = (paymentMethod: PaymentMethod): string => {
  switch (paymentMethod) {
    case 'BANK_TRANSFER':
      return 'bank';
    case 'CREDIT_CARD':
    case 'DEBIT_CARD':
      return 'card';
    case 'MOBILE_MONEY':
      return 'mobile_money';
    default:
      return 'card';
  }
};
