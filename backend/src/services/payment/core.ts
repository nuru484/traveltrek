// src/services/payment/core.ts
//
// The shared payments engine: the notification dispatcher, the customer
// contact lookup for receipts/refunds, the Paystack callback URL, the
// idempotent settle-and-confirm transaction shared by the callback and
// webhook flows, and the paginated fetch. Built once per deps.
import { BookingStatus, PaymentStatus, type Prisma } from '#config/prismaClient.js';
import { type CustomerContact } from '#notifications/deliver.js';
import { makePaymentNotifications } from '#notifications/payment-notifications.js';
import { type PaymentDeps } from '#services/payment/shared.js';
import {
  paymentInclude,
  type PaymentWithRelations,
} from '#utils/mappers/payment.mapper.js';

export type PaymentCore = ReturnType<typeof makePaymentCore>;

export const makePaymentCore = (d: PaymentDeps) => {
  const { clock, config, prisma } = d;
  const notices = makePaymentNotifications(d);

  /** Contact slice for receipts/refund notices; null when the customer row
   * is gone (soft-deleted) — the notice is then skipped. */
  const customerContact = (
    customerId: number,
  ): Promise<CustomerContact | null> =>
    prisma.customer.findFirst({
      select: { email: true, name: true, phone: true },
      where: { id: customerId },
    });

  /** The callback URL Paystack redirects to (legacy env-or-default). */
  const callbackUrl = (): string =>
    // Legacy semantics: an empty env value falls back to the default.
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    config.PAYSTACK_CALLBACK_URL ||
    'http://localhost:3000/dashboard/payments/callback';

  /**
   * Transactionally completes the payment for a verified successful charge
   * and confirms its booking. The guarded updateMany is the idempotency
   * seam: only a PENDING/FAILED payment row transitions to COMPLETED, so a
   * duplicate webhook (or the callback racing the webhook) matches zero rows
   * and reports 'already_completed' instead of re-confirming and re-sending
   * the receipt — and a REFUNDED/REFUND_REQUESTED payment is never flipped
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
    callbackUrl,
    completeVerifiedPayment,
    customerContact,
    findPage,
    notices,
  };
};
