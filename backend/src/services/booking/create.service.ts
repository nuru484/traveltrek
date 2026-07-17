// src/services/booking/create.service.ts
//
// Booking creation. Friendly existence/availability pre-checks run outside
// the transaction for good error messages; inventory is actually consumed by
// the concurrency-safe claim helpers inside it (from the booking core), so
// concurrent requests can never oversell.
import {
  BookingStatus,
  type Flight,
  FlightStatus,
  type Room,
  type Tour,
  TourStatus,
} from '#config/prismaClient.js';
import {
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
} from '#middlewares/error-handler.js';
import { type BookingCore } from '#services/booking/core.js';
import {
  type BookingActor,
  type BookingCreateInput,
  type BookingCreateResult,
  type BookingDeps,
  calculateNights,
  calculateRoomBookingPrice,
} from '#services/booking/shared.js';
import { UserRole } from '#types/user-profile.types.js';
import { bookingInclude } from '#utils/mappers/booking.mapper.js';

export const makeBookingCreateService = (d: BookingDeps, core: BookingCore) => {
  const { prisma } = d;
  const {
    calculatePaymentDeadline,
    checkRoomAvailability,
    claimFlightSeats,
    claimTourSlots,
    lockAndCountRoomsHeld,
    notices,
    validateBookingDates,
  } = core;

  const createBooking = async (
    actor: BookingActor,
    input: BookingCreateInput,
  ): Promise<BookingCreateResult> => {
    const {
      customerId,
      endDate,
      flightId,
      numberOfGuests,
      numberOfRooms,
      roomId,
      specialRequests,
      startDate,
      totalPrice,
      tourId,
    } = input;

    if (actor.role === UserRole.CUSTOMER && actor.id !== customerId) {
      throw new UnauthorizedError('Customers can only book for themselves');
    }

    if (!tourId && !roomId && !flightId) {
      throw new BadRequestError(
        'At least one of tourId, roomId, or flightId must be provided',
      );
    }

    // findFirst everywhere below so soft-deleted rows 404 like hard-deleted
    // ones did (the soft-delete extension does not scope findUnique).
    const targetCustomer = await prisma.customer.findFirst({
      where: { id: customerId },
    });
    if (!targetCustomer) throw new NotFoundError('Customer not found');

    let tour: null | Tour = null;
    let room: null | Room = null;
    let flight: Flight | null = null;
    let calculatedTotalPrice = totalPrice;
    let numberOfNights = 1;
    let paymentDeadline: Date | null = null;
    let requiresImmediatePayment = false;
    let checkInDate: Date | null = null;
    let checkOutDate: Date | null = null;

    if (tourId) {
      tour = await prisma.tour.findFirst({ where: { id: tourId } });
      if (!tour) throw new NotFoundError('Tour not found');

      const availableSlots = tour.maxGuests - tour.guestsBooked;
      const guestsToBook = numberOfGuests ?? 1;

      if (availableSlots < guestsToBook) {
        throw new BadRequestError(
          `Only ${availableSlots} slot(s) available for this tour`,
        );
      }

      if (tour.status === TourStatus.CANCELLED) {
        throw new BadRequestError('This tour has been cancelled');
      }
      if (tour.status === TourStatus.COMPLETED) {
        throw new BadRequestError('This tour has already been completed');
      }

      calculatedTotalPrice = tour.price * guestsToBook;

      const deadlineInfo = calculatePaymentDeadline(tour.startDate);
      paymentDeadline = deadlineInfo.deadline;
      requiresImmediatePayment = deadlineInfo.requiresImmediatePayment;
    }

    if (roomId) {
      if (!startDate || !endDate) {
        throw new BadRequestError(
          'startDate and endDate are required for room bookings',
        );
      }

      checkInDate = new Date(startDate);
      checkOutDate = new Date(endDate);

      const dateValidation = validateBookingDates(checkInDate, checkOutDate);
      if (!dateValidation.valid) {
        throw new BadRequestError(dateValidation.error);
      }

      room = await prisma.room.findFirst({ where: { id: roomId } });
      if (!room) throw new NotFoundError('Room not found');

      const roomsNeeded = numberOfRooms ?? 1;
      const guestsCount = numberOfGuests ?? 1;

      const totalCapacity = room.capacity * roomsNeeded;
      if (guestsCount > totalCapacity) {
        const roomsRequired = Math.ceil(guestsCount / room.capacity);
        throw new BadRequestError(
          `This room has a capacity of ${room.capacity} guest(s). ` +
            `For ${guestsCount} guest(s), you need to book at least ${roomsRequired} room(s). ` +
            `Currently requesting ${roomsNeeded} room(s).`,
        );
      }

      const availability = await checkRoomAvailability(
        roomId,
        checkInDate,
        checkOutDate,
        roomsNeeded,
      );
      if (!availability.available) {
        throw new BadRequestError(
          `Only ${availability.availableRooms} room(s) available for the selected dates. ` +
            `You requested ${roomsNeeded} room(s).`,
        );
      }

      numberOfNights = calculateNights(checkInDate, checkOutDate);
      calculatedTotalPrice = calculateRoomBookingPrice(
        room.pricePerNight,
        numberOfNights,
        roomsNeeded,
      );

      const deadlineInfo = calculatePaymentDeadline(checkInDate);
      paymentDeadline = deadlineInfo.deadline;
      requiresImmediatePayment = deadlineInfo.requiresImmediatePayment;
    }

    if (flightId) {
      flight = await prisma.flight.findFirst({ where: { id: flightId } });
      if (!flight) throw new NotFoundError('Flight not found');

      const seatsNeeded = numberOfGuests ?? 1;

      if (flight.seatsAvailable < seatsNeeded) {
        throw new BadRequestError(
          `Only ${flight.seatsAvailable} seat(s) available on this flight. ` +
            `You requested ${seatsNeeded} seat(s).`,
        );
      }

      if (flight.status === FlightStatus.CANCELLED) {
        throw new BadRequestError('This flight has been cancelled');
      }

      calculatedTotalPrice = flight.price * seatsNeeded;

      const deadlineInfo = calculatePaymentDeadline(flight.departure);
      paymentDeadline = deadlineInfo.deadline;
      requiresImmediatePayment = deadlineInfo.requiresImmediatePayment;
    }

    // Counter updates ride the same transaction as the create, so a failed
    // insert (e.g. the duplicate-booking unique constraint) rolls them back.
    // The checks above give friendly errors on plainly unavailable inventory;
    // the guarded claims below are what actually prevent overselling when
    // concurrent requests pass those checks together.
    // Note: the duplicate-booking unique constraints span soft-deleted rows
    // (khadys convention) — a soft-deleted booking still holds its
    // customer+tour/room/flight slot until it is restored or hard-purged.
    const booking = await prisma.$transaction(async (tx) => {
      if (tourId && tour) {
        const guestsToBook = numberOfGuests ?? 1;
        const claimed = await claimTourSlots(
          tx,
          tourId,
          tour.maxGuests,
          guestsToBook,
        );
        if (!claimed) {
          throw new BadRequestError(
            'The remaining slots for this tour were just booked. Please try again.',
          );
        }
      }

      if (flightId && flight) {
        const seatsNeeded = numberOfGuests ?? 1;
        const claimed = await claimFlightSeats(tx, flightId, seatsNeeded);
        if (!claimed) {
          throw new BadRequestError(
            'The remaining seats on this flight were just booked. Please try again.',
          );
        }
      }

      if (roomId && room && checkInDate && checkOutDate) {
        const roomsNeeded = numberOfRooms ?? 1;
        const roomsHeld = await lockAndCountRoomsHeld(
          tx,
          roomId,
          checkInDate,
          checkOutDate,
        );
        if (room.totalRooms - roomsHeld < roomsNeeded) {
          throw new BadRequestError(
            'The remaining rooms for the selected dates were just booked. Please try again.',
          );
        }
      }

      return await tx.booking.create({
        data: {
          // Staff attribution: an ADMIN/AGENT booking on a customer's behalf
          // is recorded as the creator; customer self-bookings stay null.
          createdBy:
            actor.role === UserRole.CUSTOMER
              ? undefined
              : { connect: { id: actor.id } },
          customer: { connect: { id: customerId } },
          endDate: roomId && endDate ? new Date(endDate) : null,
          flight: flightId ? { connect: { id: flightId } } : undefined,
          numberOfGuests: numberOfGuests ?? 1,
          numberOfNights: roomId ? numberOfNights : 1,
          numberOfRooms: roomId ? (numberOfRooms ?? 1) : 1,
          paymentDeadline: paymentDeadline,
          requiresImmediatePayment: requiresImmediatePayment,
          room: roomId ? { connect: { id: roomId } } : undefined,
          // Legacy semantics: an empty string is stored as null.
          // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
          specialRequests: specialRequests || null,
          startDate: roomId && startDate ? new Date(startDate) : null,
          status: BookingStatus.PENDING,
          totalPrice: calculatedTotalPrice,
          tour: tourId ? { connect: { id: tourId } } : undefined,
        },
        include: bookingInclude,
      });
    });

    // Fire-and-forget: the pending-booking notice (with the payment deadline)
    // never blocks or fails the request. Item details come from the rows
    // already loaded above; the created row carries the room+hotel summary.
    notices.bookingCreated(
      {
        booking: {
          endDate: booking.endDate,
          flight,
          id: booking.id,
          room: booking.room,
          startDate: booking.startDate,
          totalPrice: booking.totalPrice,
          tour,
        },
        customer: targetCustomer,
      },
      { paymentDeadline },
    );

    return {
      booking,
      details: {
        calculatedPrice: calculatedTotalPrice,
        paymentDeadline,
        requiresImmediatePayment,
        ...(roomId && { numberOfNights }),
        ...(tourId && tour && { tourStartDate: tour.startDate }),
        ...(flightId && flight && { flightDeparture: flight.departure }),
      },
    };
  };

  return { createBooking };
};
