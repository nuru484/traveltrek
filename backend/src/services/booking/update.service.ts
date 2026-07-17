// src/services/booking/update.service.ts
//
// Booking update: payment-aware status guards + the status-transition map,
// then a single transaction that re-accounts tour-guest / room / flight-seat
// inventory (using the booking core's concurrency-safe claims) and writes the
// row. Status-transition notices fire after commit.
import {
  BookingStatus,
  FlightStatus,
  PaymentStatus,
  TourStatus,
} from '#config/prismaClient.js';
import {
  BadRequestError,
  NotFoundError,
} from '#middlewares/error-handler.js';
import { type BookingCore } from '#services/booking/core.js';
import {
  type BookingDeps,
  type BookingUpdateInput,
  calculateNights,
  calculateRoomBookingPrice,
  VALID_STATUS_TRANSITIONS,
} from '#services/booking/shared.js';
import {
  bookingInclude,
  type BookingWithRelations,
} from '#utils/mappers/booking.mapper.js';

export const makeBookingUpdateService = (d: BookingDeps, core: BookingCore) => {
  const { prisma } = d;
  const {
    calculatePaymentDeadline,
    claimFlightSeats,
    claimTourSlots,
    lockAndCountRoomsHeld,
    notices,
    validateBookingDates,
  } = core;

  const updateBooking = async (
    id: number,
    input: BookingUpdateInput,
  ): Promise<BookingWithRelations> => {
    const {
      customerId,
      endDate,
      flightId,
      numberOfGuests,
      numberOfRooms,
      roomId,
      specialRequests,
      startDate,
      status,
      totalPrice,
      tourId,
    } = input;

    const existingBooking = await prisma.booking.findFirst({
      include: {
        // Contact slice for the status-transition notices below.
        customer: { select: { email: true, name: true, phone: true } },
        flight: true,
        payment: true,
        room: { include: { hotel: true } },
        tour: true,
      },
      where: { id },
    });
    if (!existingBooking) throw new NotFoundError('Booking not found');

    if (
      status === BookingStatus.PENDING &&
      existingBooking.payment?.status === PaymentStatus.COMPLETED
    ) {
      throw new BadRequestError(
        'Cannot change booking status to PENDING when payment is completed',
      );
    }

    if (
      status === BookingStatus.CANCELLED &&
      existingBooking.payment?.status === PaymentStatus.COMPLETED
    ) {
      throw new BadRequestError(
        'Cannot cancel booking when payment is completed. Please request a refund instead.',
      );
    }

    if (
      (status === BookingStatus.CONFIRMED ||
        status === BookingStatus.COMPLETED) &&
      existingBooking.payment?.status !== PaymentStatus.COMPLETED
    ) {
      throw new BadRequestError(
        `Cannot change booking status to ${status} without a completed payment`,
      );
    }

    if (status && status !== existingBooking.status) {
      const allowedStatuses = VALID_STATUS_TRANSITIONS[existingBooking.status];
      if (!allowedStatuses.includes(status)) {
        throw new BadRequestError(
          `Cannot transition booking status from ${existingBooking.status} to ${status}`,
        );
      }
    }

    if (
      (existingBooking.status === BookingStatus.COMPLETED ||
        existingBooking.status === BookingStatus.CANCELLED) &&
      (tourId || roomId || flightId || customerId || numberOfGuests)
    ) {
      throw new BadRequestError(
        `Cannot modify ${existingBooking.status.toLowerCase()} bookings`,
      );
    }

    let calculatedTotalPrice = totalPrice;
    let numberOfNights = existingBooking.numberOfNights;
    let paymentDeadline = existingBooking.paymentDeadline;
    let requiresImmediatePayment = existingBooking.requiresImmediatePayment;

    const updated = await prisma.$transaction(async (tx) => {
      if (customerId) {
        const targetCustomer = await tx.customer.findFirst({
          where: { id: customerId },
        });
        if (!targetCustomer) throw new NotFoundError('Customer not found');
      }

      if (
        tourId &&
        (tourId !== existingBooking.tourId || numberOfGuests !== undefined)
      ) {
        const tour = await tx.tour.findFirst({ where: { id: tourId } });
        if (!tour) throw new NotFoundError('Tour not found');

        const guestsToBook = numberOfGuests ?? existingBooking.numberOfGuests;
        let availableSlots = tour.maxGuests - tour.guestsBooked;

        if (tourId === existingBooking.tourId) {
          availableSlots += existingBooking.numberOfGuests;
        }

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

        if (existingBooking.tourId && tourId !== existingBooking.tourId) {
          await tx.tour.update({
            data: {
              guestsBooked: { decrement: existingBooking.numberOfGuests },
            },
            where: { id: existingBooking.tourId },
          });
        }

        if (tourId === existingBooking.tourId) {
          const guestDifference = guestsToBook - existingBooking.numberOfGuests;
          if (guestDifference > 0) {
            const claimed = await claimTourSlots(
              tx,
              tourId,
              tour.maxGuests,
              guestDifference,
            );
            if (!claimed) {
              throw new BadRequestError(
                'The remaining slots for this tour were just booked. Please try again.',
              );
            }
          } else if (guestDifference < 0) {
            await tx.tour.update({
              data: { guestsBooked: { decrement: Math.abs(guestDifference) } },
              where: { id: tourId },
            });
          }
        } else {
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

        calculatedTotalPrice = tour.price * guestsToBook;

        const deadlineInfo = calculatePaymentDeadline(tour.startDate);
        paymentDeadline = deadlineInfo.deadline;
        requiresImmediatePayment = deadlineInfo.requiresImmediatePayment;
      } else if (
        numberOfGuests !== undefined &&
        existingBooking.tourId &&
        !tourId
      ) {
        const tour = existingBooking.tour;
        if (!tour) throw new NotFoundError('Tour not found');

        const guestsToBook = numberOfGuests;
        const availableSlots =
          tour.maxGuests - tour.guestsBooked + existingBooking.numberOfGuests;

        if (availableSlots < guestsToBook) {
          throw new BadRequestError(
            `Only ${availableSlots} slot(s) available for this tour`,
          );
        }

        const guestDifference = guestsToBook - existingBooking.numberOfGuests;
        if (guestDifference > 0) {
          const claimed = await claimTourSlots(
            tx,
            existingBooking.tourId,
            tour.maxGuests,
            guestDifference,
          );
          if (!claimed) {
            throw new BadRequestError(
              'The remaining slots for this tour were just booked. Please try again.',
            );
          }
        } else if (guestDifference < 0) {
          await tx.tour.update({
            data: { guestsBooked: { decrement: Math.abs(guestDifference) } },
            where: { id: existingBooking.tourId },
          });
        }

        calculatedTotalPrice = tour.price * guestsToBook;
      }

      if (
        roomId &&
        (roomId !== existingBooking.roomId ||
          startDate ||
          endDate ||
          numberOfRooms !== undefined)
      ) {
        const room = await tx.room.findFirst({ where: { id: roomId } });
        if (!room) throw new NotFoundError('Room not found');

        const checkInDate = startDate
          ? new Date(startDate)
          : existingBooking.startDate;
        const checkOutDate = endDate
          ? new Date(endDate)
          : existingBooking.endDate;

        if (!checkInDate || !checkOutDate) {
          throw new BadRequestError(
            'Room bookings require start and end dates',
          );
        }

        const dateValidation = validateBookingDates(checkInDate, checkOutDate);
        if (!dateValidation.valid) {
          throw new BadRequestError(dateValidation.error);
        }

        const roomsNeeded = numberOfRooms ?? existingBooking.numberOfRooms;
        const guestsCount = numberOfGuests ?? existingBooking.numberOfGuests;

        const totalCapacity = room.capacity * roomsNeeded;
        if (guestsCount > totalCapacity) {
          const roomsRequired = Math.ceil(guestsCount / room.capacity);
          throw new BadRequestError(
            `This room has a capacity of ${room.capacity} guest(s). ` +
              `For ${guestsCount} guest(s), you need to book at least ${roomsRequired} room(s). ` +
              `Currently requesting ${roomsNeeded} room(s).`,
          );
        }

        // Excluding this booking's id makes the count ignore the rooms it
        // already holds (a no-op when it held a different room).
        const roomsHeld = await lockAndCountRoomsHeld(
          tx,
          roomId,
          checkInDate,
          checkOutDate,
          id,
        );
        const availableRooms = room.totalRooms - roomsHeld;

        if (availableRooms < roomsNeeded) {
          throw new BadRequestError(
            `Only ${availableRooms} room(s) available for the selected dates. ` +
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

      if (
        flightId &&
        (flightId !== existingBooking.flightId || numberOfGuests !== undefined)
      ) {
        const flight = await tx.flight.findFirst({ where: { id: flightId } });
        if (!flight) throw new NotFoundError('Flight not found');

        const seatsNeeded = numberOfGuests ?? existingBooking.numberOfGuests;

        let adjustedAvailableSeats = flight.seatsAvailable;
        if (flightId === existingBooking.flightId) {
          adjustedAvailableSeats += existingBooking.numberOfGuests;
        }

        if (adjustedAvailableSeats < seatsNeeded) {
          throw new BadRequestError(
            `Only ${adjustedAvailableSeats} seat(s) available on this flight. ` +
              `You requested ${seatsNeeded} seat(s).`,
          );
        }

        if (flight.status === FlightStatus.CANCELLED) {
          throw new BadRequestError('This flight has been cancelled');
        }

        if (existingBooking.flightId && flightId !== existingBooking.flightId) {
          await tx.flight.update({
            data: {
              seatsAvailable: { increment: existingBooking.numberOfGuests },
            },
            where: { id: existingBooking.flightId },
          });
        }

        if (flightId === existingBooking.flightId) {
          const seatDifference = seatsNeeded - existingBooking.numberOfGuests;
          if (seatDifference > 0) {
            const claimed = await claimFlightSeats(
              tx,
              flightId,
              seatDifference,
            );
            if (!claimed) {
              throw new BadRequestError(
                'The remaining seats on this flight were just booked. Please try again.',
              );
            }
          } else if (seatDifference < 0) {
            await tx.flight.update({
              data: {
                seatsAvailable: { increment: Math.abs(seatDifference) },
              },
              where: { id: flightId },
            });
          }
        } else {
          const claimed = await claimFlightSeats(tx, flightId, seatsNeeded);
          if (!claimed) {
            throw new BadRequestError(
              'The remaining seats on this flight were just booked. Please try again.',
            );
          }
        }

        calculatedTotalPrice = flight.price * seatsNeeded;

        const deadlineInfo = calculatePaymentDeadline(flight.departure);
        paymentDeadline = deadlineInfo.deadline;
        requiresImmediatePayment = deadlineInfo.requiresImmediatePayment;
      } else if (
        numberOfGuests !== undefined &&
        existingBooking.flightId &&
        !flightId
      ) {
        const flight = existingBooking.flight;
        if (!flight) throw new NotFoundError('Flight not found');

        const seatsNeeded = numberOfGuests;
        const availableSeats =
          flight.seatsAvailable + existingBooking.numberOfGuests;

        if (availableSeats < seatsNeeded) {
          throw new BadRequestError(
            `Only ${availableSeats} seat(s) available on this flight`,
          );
        }

        const seatDifference = seatsNeeded - existingBooking.numberOfGuests;
        if (seatDifference > 0) {
          const claimed = await claimFlightSeats(
            tx,
            existingBooking.flightId,
            seatDifference,
          );
          if (!claimed) {
            throw new BadRequestError(
              'The remaining seats on this flight were just booked. Please try again.',
            );
          }
        } else if (seatDifference < 0) {
          await tx.flight.update({
            data: {
              seatsAvailable: { increment: Math.abs(seatDifference) },
            },
            where: { id: existingBooking.flightId },
          });
        }

        calculatedTotalPrice = flight.price * seatsNeeded;
      }

      return await tx.booking.update({
        data: {
          customer: customerId ? { connect: { id: customerId } } : undefined,
          endDate: endDate ? new Date(endDate) : existingBooking.endDate,
          flight: flightId ? { connect: { id: flightId } } : undefined,
          numberOfGuests: numberOfGuests ?? existingBooking.numberOfGuests,
          numberOfNights: numberOfNights,
          numberOfRooms: numberOfRooms ?? existingBooking.numberOfRooms,
          paymentDeadline: paymentDeadline,
          requiresImmediatePayment: requiresImmediatePayment,
          room: roomId ? { connect: { id: roomId } } : undefined,
          specialRequests:
            specialRequests !== undefined
              ? specialRequests
              : existingBooking.specialRequests,
          startDate: startDate
            ? new Date(startDate)
            : existingBooking.startDate,
          status: status ?? existingBooking.status,
          totalPrice: calculatedTotalPrice ?? existingBooking.totalPrice,
          tour: tourId ? { connect: { id: tourId } } : undefined,
        },
        include: bookingInclude,
        where: { id },
      });
    });

    // Status-transition notices (fire-and-forget). Item details come from the
    // pre-update relations (full rows); price/dates from the updated row.
    if (status && status !== existingBooking.status) {
      const noticeInput = {
        booking: {
          endDate: updated.endDate,
          flight: existingBooking.flight,
          id: updated.id,
          room: existingBooking.room,
          startDate: updated.startDate,
          totalPrice: updated.totalPrice,
          tour: existingBooking.tour,
        },
        customer: existingBooking.customer,
      };
      if (status === BookingStatus.CONFIRMED) {
        notices.bookingConfirmed(noticeInput);
      } else if (status === BookingStatus.CANCELLED) {
        notices.bookingCancelled(noticeInput, { reason: 'customer' });
      }
    }

    return updated;
  };

  return { updateBooking };
};
