// src/services/flight/status.service.ts
//
// Flight lifecycle mutations: the status state machine (PATCH
// /flights/:id/status — the transition rules, DELAYED time handling, and the
// bookingless-cancel cascade) and single-flight delete (the non-deletable /
// active-booking / payment-record guard chain + photo cleanup).
import {
  BookingStatus,
  FlightStatus,
  PaymentStatus,
  type Prisma,
} from '#config/prismaClient.js';
import { BadRequestError, NotFoundError } from '#middlewares/error-handler.js';
import { type FlightCore } from '#services/flight/core.js';
import {
  type FlightActor,
  type FlightDeleteSummary,
  type FlightDeps,
  type FlightStatusChangeInput,
  NON_DELETABLE_STATUSES,
} from '#services/flight/shared.js';
import {
  flightFullInclude,
  type FlightWithFullRelations,
} from '#utils/mappers/flight.mapper.js';

export const makeFlightStatusService = (d: FlightDeps, core: FlightCore) => {
  const { clock, cloudinary, logger, prisma } = d;
  const { durationMinutes } = core;

  const updateFlightStatus = async (
    actor: FlightActor,
    id: number,
    change: FlightStatusChangeInput,
  ): Promise<FlightWithFullRelations> => {
    const existingFlight = await prisma.flight.findFirst({
      include: {
        bookings: { include: { payment: true }, where: { deletedAt: null } },
      },
      where: { id },
    });
    if (!existingFlight) throw new NotFoundError('Flight not found');

    const currentStatus = existingFlight.status;
    const newStatus = change.status;

    if (newStatus === currentStatus) {
      throw new BadRequestError('New status is the same as current status');
    }

    const now = clock.now();
    const originalDeparture = new Date(existingFlight.departure);
    const originalArrival = new Date(existingFlight.arrival);

    let isValidTransition = false;
    let setDepartureToNow = false;
    let setArrivalToNow = false;

    if (currentStatus === FlightStatus.SCHEDULED) {
      if (newStatus === FlightStatus.DEPARTED) {
        if (originalDeparture > now) {
          throw new BadRequestError(
            `Cannot mark flight as DEPARTED. The scheduled departure time is ${String(originalDeparture)} which is still in the future.`,
          );
        }
        isValidTransition = true;
        setDepartureToNow = true;
      } else if (
        newStatus === FlightStatus.DELAYED ||
        newStatus === FlightStatus.CANCELLED
      ) {
        isValidTransition = true;
      }
    } else if (currentStatus === FlightStatus.DELAYED) {
      if (newStatus === FlightStatus.DEPARTED) {
        if (originalDeparture > now) {
          throw new BadRequestError(
            `Cannot mark flight as DEPARTED. The delayed departure time is ${String(originalDeparture)} which is still in the future.`,
          );
        }
        isValidTransition = true;
        setDepartureToNow = true;
      } else if (
        newStatus === FlightStatus.CANCELLED ||
        newStatus === FlightStatus.SCHEDULED
      ) {
        isValidTransition = true;
      }
    } else if (currentStatus === FlightStatus.DEPARTED) {
      if (newStatus === FlightStatus.LANDED) {
        if (originalArrival > now) {
          throw new BadRequestError(
            `Cannot mark flight as LANDED. The scheduled arrival time is ${String(originalArrival)} which is still in the future.`,
          );
        }
        isValidTransition = true;
        setArrivalToNow = true;
      }
    } else if (currentStatus === FlightStatus.CANCELLED) {
      if (newStatus === FlightStatus.SCHEDULED) {
        if (originalDeparture < now) {
          throw new BadRequestError(
            `Cannot reschedule cancelled flight. The original departure time of ${String(originalDeparture)} has already passed. Please create a new flight instead.`,
          );
        }
        isValidTransition = true;
      }
    } else {
      // currentStatus === LANDED
      throw new BadRequestError(
        'Cannot change status of a flight that has already landed.',
      );
    }

    if (!isValidTransition) {
      throw new BadRequestError(
        `Invalid status transition from ${currentStatus} to ${newStatus}. Please follow proper flight status workflow.`,
      );
    }

    if (newStatus === FlightStatus.CANCELLED) {
      const hasCompletedPayments = existingFlight.bookings.some(
        (b) => b.payment?.status === PaymentStatus.COMPLETED,
      );
      if (hasCompletedPayments) {
        throw new BadRequestError(
          'Cannot cancel flight with completed payments. Please process refunds first.',
        );
      }

      const hasConfirmedBookings = existingFlight.bookings.some(
        (b) => b.status === BookingStatus.CONFIRMED,
      );
      if (hasConfirmedBookings) {
        throw new BadRequestError(
          'Cannot cancel flight with confirmed bookings. Please cancel all confirmed bookings first.',
        );
      }

      if (existingFlight.bookings.length > 0) {
        throw new BadRequestError(
          'Cannot cancel flight with existing bookings. Please cancel all bookings first.',
        );
      }
    }

    if (
      newStatus !== FlightStatus.DELAYED &&
      (change.departure || change.arrival)
    ) {
      throw new BadRequestError(
        'Time updates are only allowed when setting status to DELAYED.',
      );
    }

    let newDeparture = existingFlight.departure;
    let newArrival = existingFlight.arrival;
    let calculatedDuration = existingFlight.duration;

    if (newStatus === FlightStatus.DELAYED) {
      if (!change.departure || !change.arrival) {
        throw new BadRequestError(
          'For DELAYED status, both updated departure and arrival times are required.',
        );
      }

      newDeparture = new Date(change.departure);
      newArrival = new Date(change.arrival);

      if (isNaN(newDeparture.getTime()) || isNaN(newArrival.getTime())) {
        throw new BadRequestError(
          'Invalid date format for departure or arrival time.',
        );
      }

      if (newDeparture <= now) {
        throw new BadRequestError(
          'Delayed departure time must be in the future.',
        );
      }

      if (newArrival <= newDeparture) {
        throw new BadRequestError('Arrival time must be after departure time.');
      }

      if (newDeparture <= originalDeparture) {
        throw new BadRequestError(
          'Delayed departure time must be later than the original scheduled departure.',
        );
      }

      calculatedDuration = durationMinutes(newDeparture, newArrival);

      if (calculatedDuration < 10) {
        throw new BadRequestError(
          'Flight duration cannot be less than 10 minutes.',
        );
      }

      if (calculatedDuration > 1440) {
        throw new BadRequestError('Flight duration cannot exceed 24 hours.');
      }
    } else {
      if (setDepartureToNow) newDeparture = now;
      if (setArrivalToNow) newArrival = now;

      if (setDepartureToNow || setArrivalToNow) {
        if (newArrival <= newDeparture) {
          throw new BadRequestError(
            'Arrival time must be after departure time.',
          );
        }
        calculatedDuration = durationMinutes(newDeparture, newArrival);
      }
    }

    const data: Prisma.FlightUpdateInput = { status: newStatus };
    if (newDeparture.getTime() !== existingFlight.departure.getTime()) {
      data.departure = newDeparture;
    }
    if (newArrival.getTime() !== existingFlight.arrival.getTime()) {
      data.arrival = newArrival;
    }
    if (calculatedDuration !== existingFlight.duration) {
      data.duration = calculatedDuration;
    }

    const updatedFlight = await prisma.flight.update({
      data,
      include: flightFullInclude,
      where: { id },
    });

    logger.info(
      `Flight ${existingFlight.flightNumber} status changed from ${currentStatus} to ${newStatus} by ${actor.role} user ${actor.id}`,
    );

    // Cancelling cascades to the flight's active bookings, releasing them.
    // (With the guards above, a flight only reaches CANCELLED bookingless, so
    // this is a safety net.)
    if (newStatus === FlightStatus.CANCELLED) {
      await prisma.booking.updateMany({
        data: { status: BookingStatus.CANCELLED },
        where: {
          // updateMany is not auto-scoped; leave soft-deleted rows untouched.
          deletedAt: null,
          flightId: id,
          status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
        },
      });

      logger.info(
        `Auto-cancelled all active bookings for flight ${existingFlight.flightNumber}`,
      );
    }

    return updatedFlight;
  };

  /**
   * Deletes one flight after the guard chain, in order: non-deletable
   * status (DEPARTED/LANDED/DELAYED), active bookings, then bookings holding
   * COMPLETED/PENDING payment records. Historical bookings never block, they
   * are only logged (they survive as orphans).
   */
  const deleteFlight = async (id: number): Promise<FlightDeleteSummary> => {
    // Nested reads are not auto-scoped; soft-deleted bookings don't block.
    const flight = await prisma.flight.findFirst({
      include: {
        bookings: {
          select: {
            id: true,
            payment: { select: { amount: true, id: true, status: true } },
            status: true,
          },
          where: { deletedAt: null },
        },
      },
      where: { id },
    });
    if (!flight) throw new NotFoundError('Flight not found');

    if (NON_DELETABLE_STATUSES.includes(flight.status)) {
      throw new BadRequestError(
        `Cannot delete flight with status ${flight.status}. Only SCHEDULED or CANCELLED flights can be deleted.`,
      );
    }

    const activeBookings = flight.bookings.filter(
      (booking) =>
        booking.status === BookingStatus.CONFIRMED ||
        booking.status === BookingStatus.PENDING,
    );
    if (activeBookings.length > 0) {
      throw new BadRequestError(
        `Cannot delete flight with ${activeBookings.length} active booking(s). Please cancel all bookings first.`,
      );
    }

    const bookingsWithPayments = flight.bookings.filter(
      (booking) =>
        booking.payment &&
        (booking.payment.status === PaymentStatus.COMPLETED ||
          booking.payment.status === PaymentStatus.PENDING),
    );
    if (bookingsWithPayments.length > 0) {
      // Amounts are integer pesewas; the message keeps displaying GHS (2 dp).
      const totalAmount = bookingsWithPayments.reduce(
        (sum, booking) => sum + (booking.payment?.amount ?? 0),
        0,
      );

      throw new BadRequestError(
        `Cannot delete flight with ${bookingsWithPayments.length} booking(s) that have payment records ` +
          `(${bookingsWithPayments.filter((b) => b.payment?.status === PaymentStatus.COMPLETED).length} completed, ` +
          `${bookingsWithPayments.filter((b) => b.payment?.status === PaymentStatus.PENDING).length} pending). ` +
          `Total amount: ${(totalAmount / 100).toFixed(2)}. ` +
          `Please process refunds for all payments before deleting this flight.`,
      );
    }

    // Historical bookings survive the delete for record-keeping.
    const historicalBookings = flight.bookings.filter(
      (booking) =>
        (booking.status === BookingStatus.COMPLETED ||
          booking.status === BookingStatus.CANCELLED) &&
        (!booking.payment ||
          booking.payment.status === PaymentStatus.REFUNDED ||
          booking.payment.status === PaymentStatus.FAILED),
    );
    if (historicalBookings.length > 0) {
      logger.warn(
        `Deleting flight ${flight.flightNumber} (ID: ${id}) with ${historicalBookings.length} historical booking(s). Bookings will be orphaned.`,
      );
    }

    // Soft delete: the row survives (deletedAt set); scoped reads hide it.
    await prisma.flight.update({
      data: { deletedAt: clock.now() },
      where: { id },
    });

    if (flight.photo) {
      try {
        await cloudinary.deleteImage(flight.photo);
        logger.info(
          `Successfully deleted photo for flight ${flight.flightNumber}`,
        );
      } catch (cleanupError) {
        logger.warn(
          { err: cleanupError },
          `Failed to clean up flight photo from Cloudinary for flight ${flight.flightNumber}`,
        );
      }
    }

    logger.info(
      `Flight deleted successfully - ID: ${id}, Number: ${flight.flightNumber}, Status: ${flight.status}`,
    );

    return {
      deletedAt: clock.now().toISOString(),
      flightNumber: flight.flightNumber,
      id: flight.id,
      status: flight.status,
    };
  };

  return { deleteFlight, updateFlightStatus };
};
