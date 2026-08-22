// src/services/payment/management.service.ts
//
// Admin-only payment management: manual status update (the cash path, with the
// booking following the payment), refund (records the refund locally and
// cancels the booking), and delete (COMPLETED protected; booking reverts to
// PENDING). Receipts/refund notices run through the payment core.
import { HTTP_STATUS_CODES } from '#config/constants.js';
import { BookingStatus, PaymentStatus } from '#config/prismaClient.js';
import {
  BadRequestError,
  CustomError,
  NotFoundError,
  UnauthorizedError,
} from '#middlewares/error-handler.js';
import { bookedItemName } from '#notifications/booking-notifications.js';
import { type PaymentCore } from '#services/payment/core.js';
import {
  isPaymentStatus,
  type PaymentActor,
  type PaymentDeleteSummary,
  type PaymentDeps,
  type PaymentRefundSummary,
  type PaymentStatusUpdateSummary,
} from '#services/payment/shared.js';
import { UserRole } from '#types/user-profile.types.js';
import { paymentInclude } from '#utils/mappers/payment.mapper.js';

export const makePaymentManagementService = (
  d: PaymentDeps,
  core: PaymentCore,
) => {
  const { clock, logger, prisma } = d;
  const { customerContact, notices } = core;

  /**
   * PATCH /payments/:id — admin-only manual status update (the cash/manual
   * path). Guard order: admin gate → status whitelist → existence →
   * transition guards (COMPLETED→PENDING and any change off
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
   * Marks the payment REFUNDED and cancels its booking. The Paystack refund
   * API is never called: the refund is recorded locally and logged, and the
   * money is moved by hand. The customer gets a refund-processed notice.
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

    // An empty reason string reads as absent.
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
   * audit (409). The booking reverts to PENDING; the delete and the revert
   * are sequential writes, not one transaction.
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

  return { deletePayment, refundPayment, updatePaymentStatus };
};
