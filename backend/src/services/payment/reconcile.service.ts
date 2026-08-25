// src/services/payment/reconcile.service.ts
//
// The payment reconciliation sweep: the third confirmation path behind the
// webhook and the payer's return trip, and the safety net under refunds.
// Each stage is idempotent and bounded (small oldest-first batches, so a
// backlog drains across ticks instead of blowing one tick), and a failure
// in one row never blocks the rest. Runs from the paymentReconciliationQueue
// worker; lives here so it is testable without Redis.
import { BookingStatus, PaymentStatus } from '#config/prismaClient.js';
import { reportError } from '#lib/sentry.js';
import { bookedItemName } from '#notifications/booking-notifications.js';
import {
  isAlreadyRefundedAtProvider,
  type PaymentCore,
  REFUNDABLE_STATUSES,
} from '#services/payment/core.js';
import {
  type PaymentDeps,
  type PaymentReconciliationSummary,
} from '#services/payment/shared.js';

/** Leave a charge alone until it is this old before asking Paystack about
 * it: a payer can legitimately still be on the checkout page (mobile-money
 * OTP flows run several minutes when a code is fumbled), and the webhook
 * plus the return trip get first refusal. */
export const CHARGE_RECONCILE_MIN_AGE_MS = 10 * 60 * 1000;

/** How far back the charge stage looks: covers a webhook outage plus a
 * weekend, without re-interrogating Paystack about checkouts abandoned
 * months ago on every tick. */
export const CHARGE_RECONCILE_LOOKBACK_MS = 14 * 24 * 60 * 60 * 1000;

/** Claims reversed more recently than this are skipped: an admin refund may
 * be mid-flight (ledger claim committed, provider call not yet landed), and
 * asking Paystack in that window would race it into a doubled refund. */
export const REFUND_IN_FLIGHT_GRACE_MS = 15 * 60 * 1000;

/** A week of lookback bounds the provider calls while covering any
 * deploy or outage gap. */
export const REFUND_RECONCILE_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

const CHARGE_BATCH = 15;
const REFUND_BATCH = 8;

/** Paystack statuses meaning the charge is over and no money arrived. An
 * allowlist of the terminal ones: "ongoing", "processing", "queued" and
 * "pending" are still live, and closing a live charge would strand a payment
 * that goes on to succeed. */
const TERMINAL_PROVIDER_FAILURES = new Set(['abandoned', 'failed', 'reversed']);

export const makePaymentReconciliationService = (
  d: PaymentDeps,
  core: PaymentCore,
) => {
  const { clock, logger, paystack, prisma } = d;
  const {
    applyProviderRefund,
    cancelBookingForRefund,
    completeVerifiedPayment,
    notices,
  } = core;

  /**
   * Confirms PENDING charges that in fact settled, and closes the ones
   * Paystack reports as terminal. A charge whose booking was cancelled
   * meanwhile (the deadline sweep ran before the money was seen) is
   * refunded rather than credited: the seat is gone, so the payment cannot
   * be honoured.
   */
  const reconcileUnconfirmedCharges = async (
    olderThan: Date,
    since: Date,
  ): Promise<{ closed: number; recovered: number }> => {
    const pending = await prisma.payment.findMany({
      include: {
        booking: {
          include: {
            customer: { select: { email: true, name: true, phone: true } },
            flight: true,
            room: { include: { hotel: true } },
            tour: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: CHARGE_BATCH,
      where: {
        createdAt: { gte: since, lt: olderThan },
        status: PaymentStatus.PENDING,
        transactionReference: { not: null },
      },
    });

    let recovered = 0;
    let closed = 0;

    for (const payment of pending) {
      const reference = payment.transactionReference ?? '';
      let verified;
      try {
        verified = await paystack.verify(reference);
      } catch (error) {
        logger.error(
          { err: error, paymentId: payment.id, reference },
          'Sweep: could not verify an unconfirmed charge',
        );
        reportError(error, {
          context: { paymentId: payment.id, reference, sweep: 'charges' },
        });
        continue;
      }

      if (verified.status === 'success') {
        if (verified.amount !== payment.booking.totalPrice) {
          // Guarded on PENDING so this can never step on a confirmation that
          // landed between the read above and now.
          const { count } = await prisma.payment.updateMany({
            data: { status: PaymentStatus.FAILED },
            where: { id: payment.id, status: PaymentStatus.PENDING },
          });
          closed += count;
          logger.error(
            {
              expected: payment.booking.totalPrice,
              got: verified.amount,
              paymentId: payment.id,
              reference,
            },
            'Sweep: settled charge does not match the booking total',
          );
          continue;
        }

        if (payment.booking.status === BookingStatus.CANCELLED) {
          await refundUncreditableCharge(payment.id, reference, payment.amount);
          continue;
        }

        const outcome = await completeVerifiedPayment(
          reference,
          payment.bookingId,
        );
        if (outcome !== 'completed') continue;
        recovered += 1;
        logger.warn(
          { amount: payment.amount, paymentId: payment.id, reference },
          'Sweep: recovered a settled charge neither the webhook nor the callback confirmed',
        );
        notices.paymentReceipt({
          amount: payment.amount,
          bookingId: payment.bookingId,
          customer: payment.booking.customer,
          itemName: bookedItemName(payment.booking),
          reference,
        });
        continue;
      }

      if (TERMINAL_PROVIDER_FAILURES.has(verified.status)) {
        const { count } = await prisma.payment.updateMany({
          data: { status: PaymentStatus.FAILED },
          where: { id: payment.id, status: PaymentStatus.PENDING },
        });
        closed += count;
      }
      // Anything else is still in flight at the provider: leave it PENDING
      // and ask again next tick.
    }

    return { closed, recovered };
  };

  /** A settled charge whose booking is already gone: claim the reversal
   * (which also leaves the cancelled booking untouched) and send the money
   * back. The row moves PENDING to REFUNDED directly, so the claim happens
   * here rather than through claimRefund's COMPLETED gate. */
  const refundUncreditableCharge = async (
    paymentId: number,
    reference: string,
    amount: number,
  ): Promise<void> => {
    const { count } = await prisma.payment.updateMany({
      data: {
        refundedAt: clock.now(),
        refundReason: 'Booking was cancelled before the payment settled',
        status: PaymentStatus.REFUNDED,
      },
      where: { id: paymentId, status: PaymentStatus.PENDING },
    });
    if (count === 0) return;
    try {
      const refund = await paystack.refund({ amount, reference });
      await prisma.payment.update({
        data: { providerRefundId: refund.id },
        where: { id: paymentId },
      });
    } catch (error) {
      if (!isAlreadyRefundedAtProvider(error)) {
        // The claim stands: the unsettled-refund stage re-issues it.
        logger.error(
          { err: error, paymentId, reference },
          'Sweep: could not refund a charge on a cancelled booking',
        );
        reportError(error, {
          context: { paymentId, reference, sweep: 'charges' },
        });
      }
    }
    logger.warn(
      { amount, paymentId, reference },
      'Sweep: refunded a charge that settled after its booking was cancelled',
    );
  };

  /**
   * Re-issues refunds the ledger claimed but Paystack never received (a
   * crash between the claim and the provider call, or a refund that FAILED
   * at Paystack). Only refunds still alive at Paystack count as settled.
   */
  const reconcileUnsettledRefunds = async (since: Date): Promise<number> => {
    const settledBefore = new Date(
      clock.timestamp() - REFUND_IN_FLIGHT_GRACE_MS,
    );
    const reversed = await prisma.payment.findMany({
      orderBy: { refundedAt: 'asc' },
      take: REFUND_BATCH,
      where: {
        refundedAt: { gte: since, lte: settledBefore },
        status: PaymentStatus.REFUNDED,
        transactionReference: { not: null },
      },
    });

    let reissued = 0;
    for (const payment of reversed) {
      const reference = payment.transactionReference ?? '';
      try {
        const refunds = await paystack.listRefunds(reference);
        if (refunds.some((r) => r.status !== 'failed')) continue;
        const refund = await paystack.refund({
          amount: payment.amount,
          reference,
        });
        await prisma.payment.update({
          data: { providerRefundId: refund.id },
          where: { id: payment.id },
        });
        reissued += 1;
        logger.warn(
          { amount: payment.amount, paymentId: payment.id, reference },
          'Sweep: issued a refund the ledger claimed but Paystack never received',
        );
      } catch (error) {
        if (isAlreadyRefundedAtProvider(error)) continue;
        logger.error(
          { err: error, paymentId: payment.id, reference },
          'Sweep: could not reconcile an unsettled refund',
        );
        reportError(error, {
          context: { paymentId: payment.id, reference, sweep: 'refunds' },
        });
      }
    }
    return reissued;
  };

  /**
   * Catches refunds issued on the Paystack dashboard whose refund.processed
   * webhook never arrived: one windowed list call, matched against rows the
   * ledger still calls refundable.
   */
  const reconcileProviderRefunds = async (since: Date): Promise<number> => {
    let refunds;
    try {
      refunds = await paystack.listRefundsSince(since);
    } catch (error) {
      logger.error({ err: error }, 'Sweep: could not list provider refunds');
      return 0;
    }
    const live = refunds.filter(
      (r) => r.status !== 'failed' && r.transaction_reference,
    );
    if (live.length === 0) return 0;

    const byReference = new Map<string, (typeof live)[number]>();
    for (const r of live) {
      if (r.transaction_reference) byReference.set(r.transaction_reference, r);
    }

    const stale = await prisma.payment.findMany({
      where: {
        status: { in: [...REFUNDABLE_STATUSES] },
        transactionReference: { in: [...byReference.keys()] },
      },
    });

    let applied = 0;
    for (const payment of stale) {
      const reference = payment.transactionReference ?? '';
      const refund = byReference.get(reference);
      const outcome = await applyProviderRefund(reference, {
        providerRefundId: refund?.id ?? null,
        refundedAmount: refund?.amount ?? undefined,
      });
      if (outcome === 'applied') applied += 1;
    }
    return applied;
  };

  /**
   * Cancels bookings whose payment is REFUNDED but which are still holding
   * inventory: the admin refund cancels in the same transaction as the
   * claim, so this only ever catches rows written before that was the case
   * or a booking re-confirmed by hand after its refund.
   */
  const reconcileRefundedBookings = async (): Promise<number> => {
    const stranded = await prisma.payment.findMany({
      select: { bookingId: true, customerId: true, id: true },
      take: REFUND_BATCH,
      where: {
        booking: {
          status: { in: [BookingStatus.CONFIRMED, BookingStatus.PENDING] },
        },
        status: PaymentStatus.REFUNDED,
      },
    });
    let cancelled = 0;
    for (const payment of stranded) {
      const changed = await prisma.$transaction((tx) =>
        cancelBookingForRefund(tx, payment.bookingId),
      );
      if (changed) cancelled += 1;
    }
    return cancelled;
  };

  /** One tick: money in first, then refunds. Recovering a settled charge is
   * what stops a cancelled booking from turning into a lost payment, so it
   * runs before anything that reverses. */
  const reconcilePayments = async (): Promise<PaymentReconciliationSummary> => {
    const now = clock.timestamp();
    const charges = await reconcileUnconfirmedCharges(
      new Date(now - CHARGE_RECONCILE_MIN_AGE_MS),
      new Date(now - CHARGE_RECONCILE_LOOKBACK_MS),
    );
    const providerRefundsApplied = await reconcileProviderRefunds(
      new Date(now - REFUND_RECONCILE_LOOKBACK_MS),
    );
    const refundsReissued = await reconcileUnsettledRefunds(
      new Date(now - REFUND_RECONCILE_LOOKBACK_MS),
    );
    const bookingsCancelled = await reconcileRefundedBookings();

    const summary: PaymentReconciliationSummary = {
      bookingsCancelled,
      chargesClosed: charges.closed,
      chargesRecovered: charges.recovered,
      providerRefundsApplied,
      refundsReissued,
    };
    if (Object.values(summary).some((n) => n > 0)) {
      logger.info(summary, 'Payment reconciliation completed with changes');
    }
    return summary;
  };

  return {
    reconcilePayments,
    reconcileProviderRefunds,
    reconcileRefundedBookings,
    reconcileUnconfirmedCharges,
    reconcileUnsettledRefunds,
  };
};
