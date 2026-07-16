import { HTTP_STATUS_CODES } from '#config/constants.js';
import {
  BookingStatus,
  type PaymentMethod,
  PaymentStatus,
  type Prisma,
} from '#config/prismaClient.js';
import {
  BadRequestError,
  CustomError,
  InternalServerError,
  NotFoundError,
  UnauthorizedError,
} from '#middlewares/error-handler.js';
import { bookedItemName } from '#notifications/booking-notifications.js';
import { type CustomerContact } from '#notifications/deliver.js';
import { makePaymentNotifications } from '#notifications/payment-notifications.js';
import { type AppDeps, defaultDeps } from '#services/deps.js';
// src/services/payment.service.ts
//
// Payments domain logic, extracted from the legacy fat controller. Pure, DI'd
// functions: they take typed inputs, own every Prisma access and domain
// invariant (booking-status gates, the payment-method whitelist and its
// legacy check ORDER, resume-vs-create initialization, webhook amount
// reconciliation, status-transition and delete guards), throw the typed
// CustomError subclasses and never touch req/res. All Paystack I/O goes
// through the injected `paystack` client (never inline axios), and `new
// Date()` / `Date.now()` became the injected clock.
//
// Authorization note: like bookings, the payment role rules are NOT enforced
// by routes/payment.ts (it only authenticates), so every legacy in-handler
// check is preserved as an explicit actor-based rule — customers may only
// pay for / view their own payments, only admins may update status, refund,
// delete, or filter the list by customerId.
//
// Webhook/callback note: those two endpoints reply with legacy bespoke
// envelopes and Paystack-mandated status codes, so their functions return
// discriminated results for the controller to translate instead of throwing
// for every branch. The single exception is the webhook amount mismatch,
// which the legacy code raised as a bare `Error` (an unhandled 500) — it is
// now an InternalServerError with the same message and the same 500.
import { type IUser, UserRole } from '#types/user-profile.types.js';
import {
  paymentInclude,
  type PaymentWithRelations,
} from '#utils/mappers/payment.mapper.js';

/** Payment methods the legacy handler accepted (mirrors PaymentMethod). */
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

export interface PaymentBulkDeleteSummary {
  bookingsAffected: number;
  deletedCount: number;
}

/**
 * Outcome of the GET /payments/callback verification. `no_booking_id` and
 * `booking_not_found` were legacy early-return responses (400/404); the
 * remaining kinds are the three 200 bodies (failed / mismatch / completed).
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
  /** Filter by owner; the legacy handler honoured it for ADMIN only. */
  customerId?: number;
  limit: number;
  page: number;
  paymentMethod?: PaymentMethod;
  search?: string;
  status?: PaymentStatus;
}

export interface PaymentRefundSummary {
  bookingStatus: BookingStatus;
  payment: PaymentWithRelations;
  reason: string;
  refundAmount: number;
}

export interface PaymentStatusUpdateSummary {
  bookingStatus: BookingStatus;
  payment: PaymentWithRelations;
}

/** The subset of a Paystack webhook body the charge.success flow reads. */
export interface PaystackWebhookEvent {
  data?: {
    metadata?: { bookingId?: number | string };
    reference?: string;
  };
  event?: string;
}

const isPaymentMethod = (value: string | undefined): value is PaymentMethod =>
  value !== undefined &&
  (PAYMENT_METHODS as readonly string[]).includes(value);

const isPaymentStatus = (value: string | undefined): value is PaymentStatus =>
  value !== undefined &&
  (PAYMENT_STATUSES as readonly string[]).includes(value);

/** Paystack channel for a validated payment method (legacy mapping). */
const getPaystackChannel = (paymentMethod: PaymentMethod): string => {
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

export const makePaymentService = (
  d: Pick<
    AppDeps,
    'clock' | 'config' | 'logger' | 'mail' | 'paystack' | 'prisma' | 'sms'
  >,
) => {
  const { clock, config, logger, paystack, prisma } = d;
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
   * POST /payments — initialize a Paystack transaction for a booking. Guard
   * order is the legacy one: booking existence → ownership → booking-status
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

    // The legacy handler also fetched tour/room/flight relations here but
    // never read them; only the payment and the payer's email are used.
    // findFirst so soft-deleted bookings 404 like hard-deleted ones did.
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

    // (The legacy handler had a final `status !== PENDING` fallback here —
    // unreachable, since the three guards above cover every other status.)

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
        // totalPrice is already integer pesewas — exactly the minor units
        // Paystack expects, so no ×100 conversion (the legacy Float-GHS one
        // was removed).
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
      // A REFUNDED payment falls through, as before — the unique bookingId
      // constraint then rejects the second Payment row (Prisma P2002).
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
   * translates each outcome into the legacy bespoke envelope.
   */
  const verifyPaymentCallback = async (
    reference: string,
  ): Promise<PaymentCallbackResult> => {
    const verified = await paystack.verify(reference);

    const rawBookingId = verified.metadata?.bookingId;

    // Legacy falsy check: a missing (or zero) bookingId is 'not found'.
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

    // Paystack reports amounts in minor units — the same unit totalPrice now
    // stores (pesewas), so both the comparison and the returned amount are
    // unit-for-unit (the legacy ÷100 GHS conversions were removed).
    if (verified.status !== 'success') {
      await prisma.payment.updateMany({
        data: { status: PaymentStatus.FAILED },
        where: { transactionReference: reference },
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
        where: { transactionReference: reference },
      });

      return {
        amount: verified.amount,
        bookingId,
        kind: 'amount_mismatch',
        reference,
      };
    }

    await prisma.payment.updateMany({
      data: {
        paymentDate: clock.now(),
        status: PaymentStatus.COMPLETED,
      },
      where: { transactionReference: reference },
    });

    await prisma.booking.update({
      data: { status: BookingStatus.CONFIRMED },
      where: { id: bookingId },
    });

    return {
      amount: verified.amount,
      bookingId,
      kind: 'completed',
      reference,
    };
  };

  /**
   * POST /payments/webhook — process a (signature-verified) Paystack event.
   * charge.success is re-verified against the Paystack API, reconciled
   * against the booking total (mismatch marks the payment FAILED and raises
   * the legacy 500), then completes the payment and confirms the booking.
   * Every other event type is acknowledged untouched.
   */
  const handleWebhookEvent = async (
    event: PaystackWebhookEvent,
  ): Promise<'confirmed' | 'ignored'> => {
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

    // Both sides are integer minor units (pesewas); no ÷100.
    if (verified.amount !== booking.totalPrice) {
      await prisma.payment.updateMany({
        data: { status: PaymentStatus.FAILED },
        where: { transactionReference: reference },
      });
      // Legacy threw a bare Error here (an unhandled 500); same status and
      // message, now as a typed CustomError.
      throw new InternalServerError(
        'Payment amount does not match booking total price',
      );
    }

    await prisma.payment.updateMany({
      data: {
        paymentDate: clock.now(),
        status: PaymentStatus.COMPLETED,
      },
      where: { transactionReference: reference },
    });

    await prisma.booking.update({
      data: { status: BookingStatus.CONFIRMED },
      where: { id: bookingId },
    });

    // Fire-and-forget receipt. The callback flow deliberately sends nothing —
    // Paystack fires this webhook for the same charge, so both completing
    // would double the receipt.
    notices.paymentReceipt({
      amount: booking.totalPrice,
      bookingId,
      customer: booking.customer,
      itemName: bookedItemName(booking),
      reference,
    });

    return 'confirmed';
  };

  /** GET /payments/:id — customers may only view their own payments. */
  const getPaymentById = async (
    actor: PaymentActor,
    id: number,
  ): Promise<PaymentWithRelations> => {
    const payment = await prisma.payment.findFirst({
      include: paymentInclude,
      where: { id },
    });

    if (!payment) {
      throw new NotFoundError('Payment not found');
    }

    if (actor.role === UserRole.CUSTOMER && payment.customerId !== actor.id) {
      throw new UnauthorizedError('You can only view your own payments');
    }

    return payment;
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

  /**
   * GET /payments — customers are always scoped to their own rows; the
   * customerId filter is honoured for admins only (legacy rule: agents may
   * see everything but not filter by owner).
   */
  const listPayments = async (
    actor: PaymentActor,
    params: PaymentListParams,
  ): Promise<{ payments: PaymentWithRelations[]; total: number }> => {
    const where: Prisma.PaymentWhereInput =
      actor.role === UserRole.CUSTOMER ? { customerId: actor.id } : {};

    if (params.status) {
      where.status = params.status;
    }

    if (params.paymentMethod) {
      where.paymentMethod = params.paymentMethod;
    }

    if (params.customerId && actor.role === UserRole.ADMIN) {
      where.customerId = params.customerId;
    }

    if (params.search) {
      where.OR = [
        {
          transactionReference: {
            contains: params.search,
            mode: 'insensitive',
          },
        },
        {
          customer: { name: { contains: params.search, mode: 'insensitive' } },
        },
        {
          customer: {
            email: { contains: params.search, mode: 'insensitive' },
          },
        },
      ];
    }

    return findPage(where, params.page, params.limit);
  };

  /** GET /payments/customer/:customerId — a customer may only list their own. */
  const listCustomerPayments = async (
    actor: PaymentActor,
    customerId: number,
    params: PaymentListParams,
  ): Promise<{ payments: PaymentWithRelations[]; total: number }> => {
    if (actor.role === UserRole.CUSTOMER && actor.id !== customerId) {
      throw new UnauthorizedError('You can only view your own payments');
    }

    const where: Prisma.PaymentWhereInput = { customerId };

    if (params.status) {
      where.status = params.status;
    }

    if (params.paymentMethod) {
      where.paymentMethod = params.paymentMethod;
    }

    return findPage(where, params.page, params.limit);
  };

  /**
   * PATCH /payments/:id — admin-only manual status update (the cash/manual
   * path). Guard order is the legacy one: admin gate → status whitelist →
   * existence → transition guards (COMPLETED→PENDING and any change off
   * REFUNDED are 409s). The booking follows the payment: COMPLETED confirms
   * it, FAILED/REFUNDED cancels it, PENDING resets it.
   */
  const updatePaymentStatus = async (
    actor: PaymentActor,
    id: number,
    status: string | undefined,
  ): Promise<PaymentStatusUpdateSummary> => {
    if (actor.role !== UserRole.ADMIN) {
      throw new UnauthorizedError(
        'Only administrators can update payment status',
      );
    }

    if (!isPaymentStatus(status)) {
      throw new BadRequestError('Invalid payment status');
    }

    const payment = await prisma.payment.findFirst({
      include: { booking: true },
      where: { id },
    });

    if (!payment) {
      throw new NotFoundError('Payment not found');
    }

    if (
      payment.status === PaymentStatus.COMPLETED &&
      status === PaymentStatus.PENDING
    ) {
      throw new CustomError(
        HTTP_STATUS_CODES.CONFLICT,
        'Cannot change completed payment back to pending',
      );
    }

    if (
      payment.status === PaymentStatus.REFUNDED &&
      status !== PaymentStatus.REFUNDED
    ) {
      throw new CustomError(
        HTTP_STATUS_CODES.CONFLICT,
        'Cannot change status of refunded payment',
      );
    }

    const updatedPayment = await prisma.payment.update({
      data: {
        paymentDate:
          status === PaymentStatus.COMPLETED
            ? clock.now()
            : payment.paymentDate,
        status,
        updatedAt: clock.now(),
      },
      include: paymentInclude,
      where: { id },
    });

    let bookingStatus = payment.booking.status;

    if (status === PaymentStatus.COMPLETED) {
      bookingStatus = BookingStatus.CONFIRMED;
    } else if (
      status === PaymentStatus.FAILED ||
      status === PaymentStatus.REFUNDED
    ) {
      bookingStatus = BookingStatus.CANCELLED;
    } else {
      // The only remaining status is PENDING.
      bookingStatus = BookingStatus.PENDING;
    }

    await prisma.booking.update({
      data: { status: bookingStatus },
      where: { id: payment.bookingId },
    });

    // Manual/cash completion sends the same receipt the webhook path does.
    if (status === PaymentStatus.COMPLETED) {
      const contact = await customerContact(payment.customerId);
      if (contact) {
        notices.paymentReceipt({
          amount: updatedPayment.amount,
          bookingId: payment.bookingId,
          customer: contact,
          itemName: bookedItemName(updatedPayment.booking),
          reference: updatedPayment.transactionReference,
        });
      }
    }

    return { bookingStatus, payment: updatedPayment };
  };

  /**
   * PATCH /payments/:id/refund — admin-only; COMPLETED payments and
   * REFUND_REQUESTED ones (a customer self-cancelled a paid booking) only.
   * Marks the payment REFUNDED and cancels its booking (the legacy flow never
   * called the Paystack refund API — it only recorded the refund locally and
   * logged the request; preserved, with the console.log now on the injected
   * logger). The customer gets a refund-processed notice.
   */
  const refundPayment = async (
    actor: PaymentActor,
    id: number,
    reason: string | undefined,
  ): Promise<PaymentRefundSummary> => {
    if (actor.role !== UserRole.ADMIN) {
      throw new UnauthorizedError('Only administrators can refund payments');
    }

    const payment = await prisma.payment.findFirst({
      include: { booking: true },
      where: { id },
    });

    if (!payment) {
      throw new NotFoundError('Payment not found');
    }

    if (
      payment.status !== PaymentStatus.COMPLETED &&
      payment.status !== PaymentStatus.REFUND_REQUESTED
    ) {
      throw new CustomError(
        HTTP_STATUS_CODES.CONFLICT,
        'Only completed payments can be refunded',
      );
    }

    const refundedPayment = await prisma.payment.update({
      data: {
        status: PaymentStatus.REFUNDED,
        updatedAt: clock.now(),
      },
      include: paymentInclude,
      where: { id },
    });

    await prisma.booking.update({
      data: { status: BookingStatus.CANCELLED },
      where: { id: payment.bookingId },
    });

    // Legacy semantics: an empty reason string reads as absent.
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    const recordedReason = reason || 'No reason provided';

    logger.info(
      {
        amount: payment.amount,
        reason: recordedReason,
        transactionReference: payment.transactionReference,
      },
      `Refund requested for payment ${String(id)}`,
    );

    const contact = await customerContact(payment.customerId);
    if (contact) {
      notices.refundProcessed({
        amount: payment.amount,
        bookingId: payment.bookingId,
        customer: contact,
        itemName: bookedItemName(refundedPayment.booking),
        reference: payment.transactionReference,
      });
    }

    return {
      bookingStatus: BookingStatus.CANCELLED,
      payment: refundedPayment,
      reason: recordedReason,
      refundAmount: payment.amount,
    };
  };

  /**
   * DELETE /payments/:id — admin-only; COMPLETED payments are protected for
   * audit (409). The booking reverts to PENDING (delete and revert were
   * sequential writes in the legacy handler, not a transaction; preserved).
   */
  const deletePayment = async (
    actor: PaymentActor,
    id: number,
  ): Promise<PaymentDeleteSummary> => {
    if (actor.role !== UserRole.ADMIN) {
      throw new UnauthorizedError('Only administrators can delete payments');
    }

    const payment = await prisma.payment.findFirst({
      include: { booking: true },
      where: { id },
    });

    if (!payment) {
      throw new NotFoundError('Payment not found');
    }

    if (payment.status === PaymentStatus.COMPLETED) {
      throw new CustomError(
        HTTP_STATUS_CODES.CONFLICT,
        'Cannot delete completed payments. Consider refunding instead.',
      );
    }

    // Soft delete: the row survives (deletedAt set); scoped reads hide it.
    await prisma.payment.update({
      data: { deletedAt: clock.now() },
      where: { id },
    });

    await prisma.booking.update({
      data: { status: BookingStatus.PENDING },
      where: { id: payment.bookingId },
    });

    return { bookingId: payment.bookingId, paymentId: id };
  };

  /**
   * DELETE /payments — admin-only bulk wipe, refused entirely (409) while any
   * COMPLETED payment exists. The deleteMany and the booking status resets
   * share one transaction, as before.
   */
  const deleteAllPayments = async (
    actor: PaymentActor,
  ): Promise<PaymentBulkDeleteSummary> => {
    if (actor.role !== UserRole.ADMIN) {
      throw new UnauthorizedError('Admin privileges required');
    }

    const paymentCount = await prisma.payment.count();

    if (paymentCount === 0) {
      throw new BadRequestError('No payments to delete');
    }

    const payments = await prisma.payment.findMany({
      include: { booking: true },
    });

    const completedPayments = payments.filter(
      (p) => p.status === PaymentStatus.COMPLETED,
    );

    if (completedPayments.length > 0) {
      throw new CustomError(
        HTTP_STATUS_CODES.CONFLICT,
        `Cannot delete payments: ${String(completedPayments.length)} completed payment${completedPayments.length > 1 ? 's' : ''} must be refunded first`,
      );
    }

    const bookingIds = payments.map((p) => p.bookingId);

    await prisma.$transaction(async (tx) => {
      await tx.payment.updateMany({
        data: { deletedAt: clock.now() },
        where: { deletedAt: null },
      });

      await tx.booking.updateMany({
        data: { status: BookingStatus.PENDING },
        where: { id: { in: bookingIds } },
      });
    });

    return {
      bookingsAffected: bookingIds.length,
      deletedCount: payments.length,
    };
  };

  return {
    deleteAllPayments,
    deletePayment,
    getPaymentById,
    handleWebhookEvent,
    initializePayment,
    listCustomerPayments,
    listPayments,
    refundPayment,
    updatePaymentStatus,
    verifyPaymentCallback,
  };
};

export const paymentService = makePaymentService(defaultDeps);

export const {
  deleteAllPayments,
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
