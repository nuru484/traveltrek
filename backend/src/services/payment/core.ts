// src/services/payment/core.ts
//
// The shared payments engine: the notification dispatcher, the customer
// contact lookup for receipts/refunds, the Paystack callback URL, the
// idempotent settle-and-confirm transaction shared by the callback and
// webhook flows, the refund-side ledger writes shared by the admin refund,
// the refund webhook and the reconciliation sweep, and the paginated fetch.
// Built once per deps.
import {
  BookingStatus,
  PaymentStatus,
  type Prisma,
  type TransactionClient,
} from '#config/prismaClient.js';
import { reportError } from '#lib/sentry.js';
import { CustomError } from '#middlewares/error-handler.js';
import { bookedItemName } from '#notifications/booking-notifications.js';
import { type CustomerContact } from '#notifications/deliver.js';
import { makePaymentNotifications } from '#notifications/payment-notifications.js';
import { makeBookingCore } from '#services/booking/core.js';
import { type PaymentDeps } from '#services/payment/shared.js';
import {
  paymentInclude,
  type PaymentWithRelations,
} from '#utils/mappers/payment.mapper.js';

export type PaymentCore = ReturnType<typeof makePaymentCore>;

/** Statuses a refund may start from: a settled charge, or one parked by a
 * customer self-cancellation waiting for an administrator. */
export const REFUNDABLE_STATUSES = [
  PaymentStatus.COMPLETED,
  PaymentStatus.REFUND_REQUESTED,
] as const;

export const isRefundable = (status: PaymentStatus): boolean =>
  (REFUNDABLE_STATUSES as readonly PaymentStatus[]).includes(status);

/** "This charge was already refunded at Paystack": every refund path treats
 * it as settled (the paystack client maps the provider's 4xx to this code). */
export const isAlreadyRefundedAtProvider = (error: unknown): boolean =>
  error instanceof CustomError && error.code === 'PAYSTACK_ALREADY_REFUNDED';

export const makePaymentCore = (d: PaymentDeps) => {
  const { clock, config, logger, prisma } = d;
  const notices = makePaymentNotifications(d);
  const { restoreItemCounters } = makeBookingCore(d);

  /** Contact slice for receipts/refund notices; null when the customer row
   * is gone (soft-deleted), in which case the notice is skipped. */
  const customerContact = (
    customerId: number,
  ): Promise<CustomerContact | null> =>
    prisma.customer.findFirst({
      select: { email: true, name: true, phone: true },
      where: { id: customerId },
    });

  /** The callback URL Paystack redirects to (env value or the default). */
  const callbackUrl = (): string =>
    // An empty env value must fall back to the default, hence `||` not `??`.
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    config.PAYSTACK_CALLBACK_URL ||
    'http://localhost:3000/dashboard/payments/callback';

  /**
   * Transactionally completes the payment for a verified successful charge
   * and confirms its booking. The guarded updateMany is the idempotency
   * seam: only a PENDING/FAILED payment row transitions to COMPLETED, so a
   * duplicate webhook (or the callback racing the webhook) matches zero rows
   * and reports 'already_completed' instead of re-confirming and re-sending
   * the receipt, and a REFUNDED/REFUND_REQUESTED payment is never flipped
   * back. When no payment row exists for the reference, nothing is written:
   * a booking is never confirmed on the strength of an unknown reference.
   */
  const completeVerifiedPayment = async (
    reference: string,
    bookingId: number,
  ): Promise<'already_completed' | 'completed' | 'unknown_reference'> =>
    prisma.$transaction(async (tx) => {
      const { count } = await tx.payment.updateMany({
        data: {
          paymentDate: clock.now(),
          status: PaymentStatus.COMPLETED,
        },
        where: {
          status: { in: [PaymentStatus.FAILED, PaymentStatus.PENDING] },
          transactionReference: reference,
        },
      });

      if (count === 0) {
        // findUnique on purpose (unscoped): the unique reference stays the
        // idempotency key even if the row was soft-deleted meanwhile.
        const existing = await tx.payment.findUnique({
          where: { transactionReference: reference },
        });
        return existing ? 'already_completed' : 'unknown_reference';
      }

      await tx.booking.update({
        data: { status: BookingStatus.CONFIRMED },
        where: { id: bookingId },
      });

      return 'completed';
    });

  /**
   * Cancels the booking a refunded payment paid for, giving its inventory
   * back. A booking the customer already cancelled (the REFUND_REQUESTED
   * path restores counters at cancel time) is left alone, as is a COMPLETED
   * trip: the stay or tour was consumed, so there is nothing to release.
   * Returns whether the booking row changed.
   */
  const cancelBookingForRefund = async (
    tx: TransactionClient,
    bookingId: number,
  ): Promise<boolean> => {
    const booking = await tx.booking.findUnique({ where: { id: bookingId } });
    if (
      !booking ||
      booking.status === BookingStatus.CANCELLED ||
      booking.status === BookingStatus.COMPLETED
    ) {
      return false;
    }
    await restoreItemCounters(tx, booking);
    await tx.booking.update({
      data: { status: BookingStatus.CANCELLED },
      where: { id: bookingId },
    });
    return true;
  };

  /**
   * Claims the reversal on the ledger: only a COMPLETED or REFUND_REQUESTED
   * row moves to REFUNDED, so two concurrent refund attempts (two admin
   * clicks, a webhook racing the admin) settle on exactly one winner. The
   * booking is cancelled in the same transaction. Returns the claimed row,
   * or null when another path already reversed it.
   */
  const claimRefund = async (
    paymentId: number,
    input: { providerRefundId?: null | number; reason: string },
  ): Promise<null | PaymentWithRelations> =>
    prisma.$transaction(async (tx) => {
      const { count } = await tx.payment.updateMany({
        data: {
          providerRefundId: input.providerRefundId ?? undefined,
          refundedAt: clock.now(),
          refundReason: input.reason,
          status: PaymentStatus.REFUNDED,
        },
        where: { id: paymentId, status: { in: [...REFUNDABLE_STATUSES] } },
      });
      if (count === 0) return null;
      const payment = await tx.payment.findUniqueOrThrow({
        include: paymentInclude,
        where: { id: paymentId },
      });
      await cancelBookingForRefund(tx, payment.bookingId);
      return payment;
    });

  /**
   * Reverts a claim whose Paystack refund call failed, so an administrator
   * can retry. Guarded on REFUNDED so a concurrent successful path is never
   * undone. The booking stays cancelled: its inventory was released and a
   * failed provider call is not a reason to sell the customer's seat twice;
   * the retry refunds the same cancelled booking.
   */
  const releaseRefundClaim = async (
    paymentId: number,
    previousStatus: PaymentStatus,
  ): Promise<void> => {
    await prisma.payment.updateMany({
      data: {
        providerRefundId: null,
        refundedAt: null,
        refundReason: null,
        status: previousStatus,
      },
      where: { id: paymentId, status: PaymentStatus.REFUNDED },
    });
  };

  /**
   * Records a refund Paystack executed without going through refundPayment
   * (a dashboard refund, a dispute settlement, a recovered-charge refund the
   * sweep issued). Without this the ledger keeps saying COMPLETED while the
   * money went back. Idempotent through the guarded claim: a replayed event
   * matches no refundable row and no-ops. A partial refund has no ledger
   * representation (refunds here are always for the full amount), so it is
   * reported for a manual adjustment rather than guessed at.
   */
  const applyProviderRefund = async (
    reference: string,
    input: { providerRefundId?: null | number; refundedAmount?: number },
  ): Promise<'applied' | 'partial' | 'unchanged' | 'unknown_reference'> => {
    const payment = await prisma.payment.findUnique({
      where: { transactionReference: reference },
    });
    if (!payment) {
      logger.warn({ reference }, 'Refund for an unknown Paystack reference');
      return 'unknown_reference';
    }
    if (
      input.refundedAmount !== undefined &&
      input.refundedAmount < payment.amount
    ) {
      logger.error(
        {
          paymentAmount: payment.amount,
          paymentId: payment.id,
          reference,
          refundedAmount: input.refundedAmount,
        },
        'Partial Paystack refund needs a manual ledger adjustment',
      );
      reportError(new Error('Partial Paystack refund needs manual handling'), {
        context: {
          paymentAmount: payment.amount,
          paymentId: payment.id,
          reference,
          refundedAmount: input.refundedAmount,
        },
      });
      return 'partial';
    }

    const claimed = await claimRefund(payment.id, {
      providerRefundId: input.providerRefundId,
      reason: 'Refunded at Paystack',
    });
    if (!claimed) return 'unchanged';

    logger.warn(
      { amount: payment.amount, paymentId: payment.id, reference },
      'Provider-side refund applied to the ledger',
    );

    const contact = await customerContact(payment.customerId);
    if (contact) {
      notices.refundProcessed({
        amount: payment.amount,
        bookingId: payment.bookingId,
        customer: contact,
        itemName: bookedItemName(claimed.booking),
        reference: payment.transactionReference,
      });
    }
    return 'applied';
  };

  const findPage = async (
    where: Prisma.PaymentWhereInput,
    page: number,
    limit: number,
  ): Promise<{ payments: PaymentWithRelations[]; total: number }> => {
    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        include: paymentInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        where,
      }),
      prisma.payment.count({ where }),
    ]);

    return { payments, total };
  };

  return {
    applyProviderRefund,
    callbackUrl,
    cancelBookingForRefund,
    claimRefund,
    completeVerifiedPayment,
    customerContact,
    findPage,
    notices,
    releaseRefundClaim,
  };
};
