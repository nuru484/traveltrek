// src/services/payment/checkout.service.ts
//
// The Paystack money flow: POST /payments (initialize / resume), GET
// /payments/callback (verify after redirect), and POST /payments/webhook
// (process a signature-verified event: charge settlement, provider-side
// refunds, failed refunds, disputes). Settlement + booking confirmation and
// the receipt run through the shared payment core, so the callback and webhook
// can't double-confirm or double-notify.
import { BookingStatus, PaymentStatus } from '#config/prismaClient.js';
import { reportError } from '#lib/sentry.js';
import {
  BadRequestError,
  InternalServerError,
  NotFoundError,
  UnauthorizedError,
} from '#middlewares/error-handler.js';
import { bookedItemName } from '#notifications/booking-notifications.js';
import { type PaymentCore } from '#services/payment/core.js';
import {
  getPaystackChannel,
  isPaymentMethod,
  type PaymentActor,
  type PaymentCallbackResult,
  type PaymentDeps,
  type PaymentInitializeInput,
  type PaymentInitializeResult,
  type PaymentWebhookOutcome,
  type PaystackWebhookEvent,
} from '#services/payment/shared.js';
import { UserRole } from '#types/user-profile.types.js';

export const makePaymentCheckoutService = (
  d: PaymentDeps,
  core: PaymentCore,
) => {
  const { clock, logger, paystack, prisma } = d;
  const { applyProviderRefund, callbackUrl, completeVerifiedPayment, notices } =
    core;

  /**
   * POST /payments — initialize a Paystack transaction for a booking. Guard
   * order: booking existence → ownership → booking-status
   * gates → payment-method whitelist → existing-payment triage (COMPLETED
   * 400, PENDING resumes the session with its original reference, FAILED
   * 400). Only then is a fresh transaction initialized and the Payment row
   * created in PENDING state with the Paystack-confirmed reference.
   */
  const initializePayment = async (
    actor: PaymentActor,
    input: PaymentInitializeInput,
  ): Promise<PaymentInitializeResult> => {
    const { bookingId, paymentMethod } = input;

    // Only the payment and the payer's email are read from this row.
    // findFirst so soft-deleted bookings 404.
    const booking = await prisma.booking.findFirst({
      include: {
        customer: true,
        payment: true,
      },
      where: { id: bookingId },
    });

    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    if (actor.role === UserRole.CUSTOMER && booking.customerId !== actor.id) {
      throw new UnauthorizedError('You can only pay for your own bookings');
    }

    if (booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestError('Cannot pay for cancelled booking');
    }

    if (booking.status === BookingStatus.COMPLETED) {
      throw new BadRequestError('Booking already completed');
    }

    if (booking.status === BookingStatus.CONFIRMED) {
      throw new BadRequestError('Booking already paid for');
    }

    // No fallback branch for a non-PENDING status: the three guards above
    // cover every other status.

    if (!isPaymentMethod(paymentMethod)) {
      throw new BadRequestError('Invalid payment method');
    }

    // Paystack requires a customer email on every transaction; phone-only
    // accounts must add one before they can pay online.
    const payerEmail = booking.customer.email;
    if (!payerEmail) {
      throw new BadRequestError(
        'An email address is required for online payment; please add one to your profile',
      );
    }

    if (booking.payment) {
      if (booking.payment.status === PaymentStatus.COMPLETED) {
        throw new BadRequestError('Payment already completed');
      }

      if (booking.payment.status === PaymentStatus.PENDING) {
        // Re-initialize Paystack for the existing pending payment.
        // totalPrice is already integer pesewas: exactly the minor units
        // Paystack expects, so no ×100 conversion.
        const resumed = await paystack.initialize({
          amount: booking.totalPrice,
          callbackUrl: callbackUrl(),
          channels: [getPaystackChannel(paymentMethod)],
          currency: 'GHS',
          email: payerEmail,
          metadata: { bookingId },
          reference: booking.payment.transactionReference ?? undefined,
        });

        return {
          authorizationUrl: resumed.authorization_url,
          paymentId: booking.payment.id,
          resumed: true,
          transactionReference: booking.payment.transactionReference ?? '',
        };
      }

      if (booking.payment.status === PaymentStatus.FAILED) {
        throw new BadRequestError(
          'Previous payment failed. Please contact support',
        );
      }
      // A REFUNDED payment falls through: the unique bookingId constraint
      // then rejects the second Payment row (Prisma P2002).
    }

    // totalPrice is already integer pesewas (Paystack minor units); no ×100.
    const initialized = await paystack.initialize({
      amount: booking.totalPrice,
      callbackUrl: callbackUrl(),
      channels: [getPaystackChannel(paymentMethod)],
      currency: 'GHS',
      email: payerEmail,
      metadata: { bookingId },
      reference: `booking_${String(bookingId)}_${String(clock.now().getTime())}`,
    });

    const payment = await prisma.payment.create({
      data: {
        amount: booking.totalPrice,
        bookingId: bookingId,
        currency: 'GHS',
        customerId: booking.customerId,
        paymentMethod,
        status: PaymentStatus.PENDING,
        transactionReference: initialized.reference,
      },
    });

    return {
      authorizationUrl: initialized.authorization_url,
      paymentId: payment.id,
      resumed: false,
      transactionReference: initialized.reference,
    };
  };

  /**
   * GET /payments/callback — verify a transaction after Paystack redirects
   * back. Marks the payment FAILED on an unsuccessful charge or an amount
   * mismatch, COMPLETED (+ booking CONFIRMED) on success; the controller
   * translates each outcome into the callback's bespoke envelope.
   */
  const verifyPaymentCallback = async (
    reference: string,
  ): Promise<PaymentCallbackResult> => {
    const verified = await paystack.verify(reference);

    const rawBookingId = verified.metadata?.bookingId;

    // A missing (or zero) bookingId reads as 'not found'.
    if (
      !rawBookingId ||
      (typeof rawBookingId !== 'number' && typeof rawBookingId !== 'string')
    ) {
      return { kind: 'no_booking_id' };
    }

    const bookingId = parseInt(String(rawBookingId), 10);

    const booking = await prisma.booking.findFirst({
      where: { id: bookingId },
    });

    if (!booking) {
      return { kind: 'booking_not_found' };
    }

    // Paystack reports amounts in minor units, the same unit totalPrice
    // stores (pesewas), so both the comparison and the returned amount are
    // unit-for-unit; no ÷100 conversion.
    // The FAILED writes below only touch unsettled rows so a stray re-verify
    // can never clobber a payment that already COMPLETED or refunded.
    if (verified.status !== 'success') {
      await prisma.payment.updateMany({
        data: { status: PaymentStatus.FAILED },
        where: {
          status: PaymentStatus.PENDING,
          transactionReference: reference,
        },
      });

      return {
        amount: verified.amount,
        bookingId,
        kind: 'not_successful',
        reference,
      };
    }

    if (verified.amount !== booking.totalPrice) {
      await prisma.payment.updateMany({
        data: { status: PaymentStatus.FAILED },
        where: {
          status: PaymentStatus.PENDING,
          transactionReference: reference,
        },
      });

      return {
        amount: verified.amount,
        bookingId,
        kind: 'amount_mismatch',
        reference,
      };
    }

    const outcome = await completeVerifiedPayment(reference, bookingId);

    if (outcome === 'unknown_reference') {
      throw new NotFoundError('Payment not found for transaction reference');
    }

    // 'already_completed' (the webhook won the race) reads as success too.
    return {
      amount: verified.amount,
      bookingId,
      kind: 'completed',
      reference,
    };
  };

  /**
   * POST /payments/webhook - process a (signature-verified) Paystack event.
   *
   * - charge.success is re-verified against the Paystack API, reconciled
   *   against the booking total (mismatch marks the payment FAILED and raises
   *   a 500), then completes the payment and confirms the booking.
   * - refund.processed records a refund executed at Paystack (dashboard,
   *   dispute settlement) so the ledger never overstates revenue.
   * - refund.failed means a refund the ledger already claimed died at
   *   Paystack (insufficient payout balance, for instance); it is reported
   *   and the reconciliation sweep re-issues it.
   * - charge.dispute.create needs a human (evidence upload on the Paystack
   *   dashboard); it is reported and acknowledged.
   * Every other event type is acknowledged untouched.
   */
  const handleWebhookEvent = async (
    event: PaystackWebhookEvent,
  ): Promise<PaymentWebhookOutcome> => {
    const chargeReference =
      event.data?.transaction_reference ?? event.data?.reference;

    if (event.event === 'refund.processed') {
      if (!chargeReference) return 'ignored';
      const outcome = await applyProviderRefund(chargeReference, {
        providerRefundId: event.data?.id ?? null,
        refundedAmount: event.data?.amount,
      });
      return outcome === 'applied' ? 'refund_applied' : 'ignored';
    }

    if (event.event === 'refund.failed') {
      logger.error(
        { reference: chargeReference },
        'Paystack refund failed; the reconciliation sweep will re-issue it',
      );
      reportError(new Error('Paystack refund failed'), {
        context: { reference: chargeReference ?? null },
      });
      return 'ignored';
    }

    if (event.event === 'charge.dispute.create') {
      logger.error(
        { reference: chargeReference },
        'Paystack dispute opened; needs attention on the Paystack dashboard',
      );
      reportError(new Error('Paystack dispute opened'), {
        context: { reference: chargeReference ?? null },
      });
      return 'ignored';
    }

    if (event.event !== 'charge.success') {
      return 'ignored';
    }

    const reference = event.data?.reference ?? '';
    const bookingId = Number(event.data?.metadata?.bookingId);

    const verified = await paystack.verify(reference);

    const booking = await prisma.booking.findFirst({
      include: {
        // Contact + item slices for the payment receipt sent below.
        customer: { select: { email: true, name: true, phone: true } },
        flight: true,
        room: { include: { hotel: true } },
        tour: true,
      },
      where: { id: bookingId },
    });

    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    // Both sides are integer minor units (pesewas); no /100. Only an
    // unsettled row is marked FAILED: a mismatch replay can't clobber a
    // payment that already COMPLETED or refunded.
    if (verified.amount !== booking.totalPrice) {
      await prisma.payment.updateMany({
        data: { status: PaymentStatus.FAILED },
        where: {
          status: PaymentStatus.PENDING,
          transactionReference: reference,
        },
      });
      // A typed CustomError so the central error middleware answers 500 with
      // this message instead of a bare unhandled throw.
      throw new InternalServerError(
        'Payment amount does not match booking total price',
      );
    }

    const outcome = await completeVerifiedPayment(reference, bookingId);

    if (outcome === 'unknown_reference') {
      // No payment row for this reference: never confirm the booking on the
      // strength of an unknown reference. 404 lets Paystack retry a few
      // times in case the initialize write is lagging.
      throw new NotFoundError('Payment not found for transaction reference');
    }

    if (outcome === 'already_completed') {
      // Duplicate delivery (or the callback already settled it): acknowledge
      // without re-confirming the booking or re-sending the receipt.
      return 'ignored';
    }

    // Fire-and-forget receipt, sent exactly once, only by the delivery that
    // actually transitioned the payment. The callback flow deliberately
    // sends nothing: Paystack fires this webhook for the same charge, so
    // both completing would double the receipt.
    notices.paymentReceipt({
      amount: booking.totalPrice,
      bookingId,
      customer: booking.customer,
      itemName: bookedItemName(booking),
      reference,
    });

    return 'confirmed';
  };

  return { handleWebhookEvent, initializePayment, verifyPaymentCallback };
};
