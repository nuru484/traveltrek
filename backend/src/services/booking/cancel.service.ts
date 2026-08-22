// src/services/booking/cancel.service.ts
//
// The remove/cancel paths: admin/agent delete (soft-delete + counter
// restore), customer self-cancellation (with the paid-booking
// REFUND_REQUESTED hand-off), and the deadline-expiry sweep the
// bookingDeadlineQueue worker runs. Counter restoration is the shared core
// helper; each path wraps it with its own guards.
import pMap from 'p-map';

import { BookingStatus, PaymentStatus } from '#config/prismaClient.js';
import {
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
} from '#middlewares/error-handler.js';
import { type BookingCore } from '#services/booking/core.js';
import {
  type BookingActor,
  type BookingCancelResult,
  type BookingDeleteSummary,
  type BookingDeps,
  type ExpiredBookingsSweepSummary,
} from '#services/booking/shared.js';
import { UserRole } from '#types/user-profile.types.js';
import { bookingInclude } from '#utils/mappers/booking.mapper.js';

export const makeBookingCancelService = (d: BookingDeps, core: BookingCore) => {
  const { clock, logger, prisma } = d;
  const { notices, restoreItemCounters } = core;

  /**
   * Deletes one booking after the guard chain (COMPLETED status,
   * payment status, past confirmed bookings), restoring tour-guest / flight-
   * seat counters and removing a non-completed payment in one transaction.
   */
  const deleteBooking = async (
    actor: BookingActor,
    id: number,
  ): Promise<BookingDeleteSummary> => {
    if (actor.role !== UserRole.ADMIN && actor.role !== UserRole.AGENT) {
      throw new UnauthorizedError('Only admins and agents can delete bookings');
    }

    const booking = await prisma.booking.findFirst({
      include: {
        customer: { select: { email: true, id: true, name: true } },
        payment: true,
      },
      where: { id },
    });
    if (!booking) throw new NotFoundError('Booking not found');

    if (booking.status === BookingStatus.COMPLETED) {
      throw new BadRequestError('Completed bookings cannot be deleted');
    }

    if (booking.payment) {
      const paymentStatus = booking.payment.status;

      if (paymentStatus === PaymentStatus.COMPLETED) {
        throw new BadRequestError(
          'Cannot delete booking with completed payment. Please process a refund first or update payment status to PENDING.',
        );
      }

      const allowedPaymentStatuses: string[] = [
        'PENDING',
        'FAILED',
        'CANCELLED',
        'REFUNDED',
      ];
      if (!allowedPaymentStatuses.includes(paymentStatus)) {
        throw new BadRequestError(
          `Cannot delete booking with payment status "${paymentStatus}". Allowed statuses: ${allowedPaymentStatuses.join(', ')}`,
        );
      }
    }

    if (booking.status === BookingStatus.CONFIRMED) {
      const bookingDate = new Date(booking.bookingDate);
      const currentDate = clock.now();

      if (bookingDate < currentDate) {
        throw new BadRequestError(
          'Cannot delete past confirmed bookings. Please cancel the booking instead.',
        );
      }
    }

    const deletedAt = clock.now();
    await prisma.$transaction(async (tx) => {
      await restoreItemCounters(tx, booking);

      // Soft-delete the payment alongside the booking: the Payment→Booking FK
      // cascade never fires for a soft delete, so the payment must be
      // tombstoned explicitly in every deletable case.
      if (booking.payment) {
        await tx.payment.update({
          data: { deletedAt },
          where: { id: booking.payment.id },
        });
      }

      await tx.booking.update({ data: { deletedAt }, where: { id } });
    });

    return {
      deletedBookingId: id,
      restoredAvailability: {
        flight: booking.flightId ? true : false,
        room: booking.roomId ? 'date-based' : false,
        tour: booking.tourId ? true : false,
      },
      restoredQuantities: {
        flightSeats: booking.flightId ? booking.numberOfGuests : 0,
        tourGuests: booking.tourId ? booking.numberOfGuests : 0,
      },
    };
  };

  /**
   * POST /bookings/:id/cancel — customer self-cancellation (staff may cancel
   * any booking through it too). Rules:
   *
   * - customers may only cancel their OWN bookings;
   * - already CANCELLED / COMPLETED bookings are refused (400), as is any
   *   booking whose trip has already started (tour start / room check-in /
   *   flight departure in the past);
   * - PENDING (or unpaid CONFIRMED) → cancelled outright, counters restored;
   * - CONFIRMED with a COMPLETED payment → cancelled, counters restored, and
   *   the payment moves to REFUND_REQUESTED for an admin to action via
   *   PATCH /payments/:id/refund (`refundRequested: true` in the result).
   *
   * Unlike the generic status-update path (which refuses CANCELLED while a
   * payment is COMPLETED), this flow owns the paid case by parking the money
   * on REFUND_REQUESTED — cancel and payment move in one transaction.
   */
  const cancelBooking = async (
    actor: BookingActor,
    id: number,
  ): Promise<BookingCancelResult> => {
    const booking = await prisma.booking.findFirst({
      include: {
        customer: { select: { email: true, name: true, phone: true } },
        flight: true,
        payment: true,
        room: { include: { hotel: true } },
        tour: true,
      },
      where: { id },
    });
    if (!booking) throw new NotFoundError('Booking not found');

    if (actor.role === UserRole.CUSTOMER && booking.customerId !== actor.id) {
      throw new UnauthorizedError('You can only cancel your own bookings');
    }

    if (booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestError('This booking is already cancelled');
    }
    if (booking.status === BookingStatus.COMPLETED) {
      throw new BadRequestError('Completed bookings cannot be cancelled');
    }

    // Cancellation cutoff: once the trip has started there is nothing left
    // to cancel — the stay/tour/flight is being (or has been) consumed.
    const tripStart =
      booking.tour?.startDate ?? booking.flight?.departure ?? booking.startDate;
    if (tripStart && tripStart.getTime() <= clock.timestamp()) {
      throw new BadRequestError(
        'This booking can no longer be cancelled because the trip has already started',
      );
    }

    const refundRequested =
      booking.payment?.status === PaymentStatus.COMPLETED;

    const cancelled = await prisma.$transaction(async (tx) => {
      await restoreItemCounters(tx, booking);

      if (refundRequested && booking.payment) {
        await tx.payment.update({
          data: { status: PaymentStatus.REFUND_REQUESTED },
          where: { id: booking.payment.id },
        });
      }

      return await tx.booking.update({
        data: { status: BookingStatus.CANCELLED },
        include: bookingInclude,
        where: { id },
      });
    });

    notices.bookingCancelled(
      { booking, customer: booking.customer },
      { reason: 'customer', refundRequested },
    );

    return { booking: cancelled, refundRequested };
  };

  /**
   * The deadline-expiry sweep the bookingDeadlineQueue worker runs: cancels
   * every PENDING booking whose payment deadline has passed, restoring its
   * counters (cancel + restores are atomic per booking; one failure never
   * blocks the rest) and notifying the customer with the deadline-expired
   * variant. Lives here (not in the worker) so it is unit-testable and the
   * worker stays a thin trigger.
   */
  const cancelExpiredBookings =
    async (): Promise<ExpiredBookingsSweepSummary> => {
      const now = clock.now();

      const expiredBookings = await prisma.booking.findMany({
        include: {
          customer: { select: { email: true, name: true, phone: true } },
          flight: true,
          room: { include: { hotel: true } },
          tour: true,
        },
        where: {
          paymentDeadline: { lte: now },
          status: BookingStatus.PENDING,
        },
      });

      if (expiredBookings.length === 0) {
        return { cancelledCount: 0, failureCount: 0 };
      }

      let cancelledCount = 0;
      let failureCount = 0;

      await pMap(
        expiredBookings,
        async (booking) => {
          try {
            await prisma.$transaction(async (tx) => {
              await tx.booking.update({
                data: { status: BookingStatus.CANCELLED },
                where: { id: booking.id },
              });
              await restoreItemCounters(tx, booking);
            });

            cancelledCount++;
            notices.bookingCancelled(
              { booking, customer: booking.customer },
              { reason: 'deadline' },
            );
            logger.info(
              { bookingId: booking.id, customerId: booking.customerId },
              'Cancelled booking past its payment deadline',
            );
          } catch (err) {
            failureCount++;
            logger.error(
              { bookingId: booking.id, err },
              'Failed to cancel expired booking',
            );
          }
        },
        { concurrency: 10 },
      );

      return { cancelledCount, failureCount };
    };

  return { cancelBooking, cancelExpiredBookings, deleteBooking };
};
