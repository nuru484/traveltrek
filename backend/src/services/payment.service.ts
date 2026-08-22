import { defaultDeps } from '#services/deps.js';
// src/services/payment.service.ts
//
// Thin composer for the payments domain. The implementation is split into
// modules under ./payment: shared.ts (method/status whitelists, types, guards,
// the Paystack channel map), core.ts (notifications, contact lookup, the
// callback URL, the idempotent settle-and-confirm transaction, pagination),
// and one module per surface (checkout = initialize/callback/webhook, query,
// management = status/refund/delete). makePaymentService builds the core once
// and spreads each feature factory into one object, preserving the public
// surface controllers/tests import from this path.
//
// Authorization note: like bookings, the payment role rules are enforced in
// the service modules, not the routes — customers may only pay for/view their
// own payments; only admins may update status, refund, delete, or filter by
// customerId.
import { makePaymentCheckoutService } from '#services/payment/checkout.service.js';
import { makePaymentCore } from '#services/payment/core.js';
import { makePaymentManagementService } from '#services/payment/management.service.js';
import { makePaymentQueryService } from '#services/payment/query.service.js';
import {
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  type PaymentActor,
  type PaymentCallbackResult,
  type PaymentDeleteSummary,
  type PaymentDeps,
  type PaymentInitializeInput,
  type PaymentInitializeResult,
  type PaymentListParams,
  type PaymentRefundSummary,
  type PaymentStatusUpdateSummary,
  type PaystackWebhookEvent,
} from '#services/payment/shared.js';

// Re-export the public types/consts controllers/tests import from this module
// path.
export {
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  type PaymentActor,
  type PaymentCallbackResult,
  type PaymentDeleteSummary,
  type PaymentInitializeInput,
  type PaymentInitializeResult,
  type PaymentListParams,
  type PaymentRefundSummary,
  type PaymentStatusUpdateSummary,
  type PaystackWebhookEvent,
};

export const makePaymentService = (d: PaymentDeps) => {
  const core = makePaymentCore(d);
  return {
    ...makePaymentCheckoutService(d, core),
    ...makePaymentQueryService(d, core),
    ...makePaymentManagementService(d, core),
  };
};

export const paymentService = makePaymentService(defaultDeps);

export const {
  deletePayment,
  getPaymentById,
  handleWebhookEvent,
  initializePayment,
  listCustomerPayments,
  listPayments,
  refundPayment,
  updatePaymentStatus,
  verifyPaymentCallback,
} = paymentService;
