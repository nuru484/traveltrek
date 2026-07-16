// src/controllers/bookingController.ts
import { NextFunction, Request, RequestHandler, Response } from 'express';
import { param } from 'express-validator';
import { IBooking, IBookingInput, IBookingRoom } from 'types/booking.types';

import { HTTP_STATUS_CODES } from '../config/constants';
import prisma from '../config/prismaClient';
import {
  asyncHandler,
  BadRequestError,
  CustomError,
  NotFoundError,
  UnauthorizedError,
} from '../middlewares/error-handler';
import validationMiddleware from '../middlewares/validation';
import {
  calculateNights,
  calculatePaymentDeadline,
  calculateRoomBookingPrice,
  checkRoomAvailability,
  validateBookingDates,
} from '../utils/bookingHelpers';
import {
  createBookingValidation,
  getBookingsValidation,
  updateBookingValidation,
} from '../validations/bookingValidations';

/**
 * Shared include object for booking queries
 */
const bookingInclude = {
  flight: {
    select: {
      airline: true,
      destination: {
        select: {
          city: true,
          country: true,
          id: true,
          name: true,
        },
      },
      flightNumber: true,
      id: true,
      origin: {
        select: {
          city: true,
          country: true,
          id: true,
          name: true,
        },
      },
    },
  },
  payment: {
    select: {
      amount: true,
      id: true,
      paymentMethod: true,
      status: true,
    },
  },
  room: {
    select: {
      description: true,
      hotel: {
        select: {
          description: true,
          destination: {
            select: {
              city: true,
              country: true,
              id: true,
              name: true,
            },
          },
          id: true,
          name: true,
        },
      },
      id: true,
      roomType: true,
    },
  },
  tour: {
    select: {
      description: true,
      destination: {
        select: {
          city: true,
          country: true,
          id: true,
          name: true,
        },
      },
      id: true,
      name: true,
    },
  },
  user: {
    select: { email: true, id: true, name: true },
  },
};

/**
 * Helper function to format booking response
 */
const formatBookingResponse = (booking: any): IBooking => {
  const baseResponse = {
    bookingDate: booking.bookingDate,
    createdAt: booking.createdAt,
    id: booking.id,
    numberOfGuests: booking.numberOfGuests,
    payment: booking.payment,
    paymentDeadline: booking.paymentDeadline,
    specialRequests: booking.specialRequests,
    status: booking.status,
    totalPrice: booking.totalPrice,
    updatedAt: booking.updatedAt,
    user: booking.user,
    userId: booking.userId,
  };

  if (booking.tour) {
    return {
      ...baseResponse,
      flight: null,
      room: null,
      tour: booking.tour,
      type: 'TOUR',
    };
  } else if (booking.room) {
    const roomData: IBookingRoom = {
      description: booking.room.description,
      endDate: booking.endDate,
      hotel: booking.room.hotel,
      id: booking.room.id,
      numberOfNights: booking.numberOfNights,
      numberOfRooms: booking.numberOfRooms,
      roomType: booking.room.roomType,
      startDate: booking.startDate,
    };

    return {
      ...baseResponse,
      flight: null,
      room: roomData,
      tour: null,
      type: 'ROOM',
    };
  } else if (booking.flight) {
    return {
      ...baseResponse,
      flight: booking.flight,
      room: null,
      tour: null,
      type: 'FLIGHT',
    };
  }

  throw new BadRequestError(
    'Booking has no associated item (tour, room, or flight)',
  );
};

const handleCreateBooking = asyncHandler(
  async (
    req: Request<{}, {}, IBookingInput>,
    res: Response,
    _next: NextFunction,
  ): Promise<void> => {
    const {
      endDate,
      flightId,
      numberOfGuests,
      numberOfRooms,
      roomId,
      specialRequests,
      startDate,
      totalPrice,
      tourId,
      userId,
    } = req.body;

    const user = req.user;

    if (!user) {
      throw new UnauthorizedError('Unauthorized, no user provided');
    }

    if (user.role === 'CUSTOMER' && user.id !== userId) {
      throw new UnauthorizedError('Customers can only book for themselves');
    }

    if (!tourId && !roomId && !flightId) {
      throw new BadRequestError(
        'At least one of tourId, roomId, or flightId must be provided',
      );
    }

    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser) throw new NotFoundError('User not found');

    let tour = null;
    let room = null;
    let flight = null;
    let calculatedTotalPrice = totalPrice;
    let numberOfNights = 1;
    let paymentDeadline: Date | null = null;
    let requiresImmediatePayment = false;

    if (tourId) {
      tour = await prisma.tour.findUnique({ where: { id: tourId } });
      if (!tour) throw new NotFoundError('Tour not found');

      const availableSlots = tour.maxGuests - tour.guestsBooked;
      const guestsToBook = numberOfGuests || 1;

      if (availableSlots < guestsToBook) {
        throw new BadRequestError(
          `Only ${availableSlots} slot(s) available for this tour`,
        );
      }

      if (tour.status === 'CANCELLED') {
        throw new BadRequestError('This tour has been cancelled');
      }
      if (tour.status === 'COMPLETED') {
        throw new BadRequestError('This tour has already been completed');
      }

      calculatedTotalPrice = tour.price * guestsToBook;

      const deadlineInfo = calculatePaymentDeadline(tour.startDate);
      paymentDeadline = deadlineInfo.deadline;
      requiresImmediatePayment = deadlineInfo.requiresImmediatePayment;
    }

    // Handle Room Booking
    if (roomId) {
      if (!startDate || !endDate) {
        throw new BadRequestError(
          'startDate and endDate are required for room bookings',
        );
      }

      const checkInDate = new Date(startDate);
      const checkOutDate = new Date(endDate);

      // Validate booking dates
      const dateValidation = validateBookingDates(checkInDate, checkOutDate);

      if (!dateValidation.valid) {
        throw new BadRequestError(dateValidation.error);
      }

      room = await prisma.room.findUnique({ where: { id: roomId } });
      if (!room) throw new NotFoundError('Room not found');

      const roomsNeeded = numberOfRooms || 1;
      const guestsCount = numberOfGuests || 1;

      // Check if guests exceed room capacity
      const totalCapacity = room.capacity * roomsNeeded;
      if (guestsCount > totalCapacity) {
        const roomsRequired = Math.ceil(guestsCount / room.capacity);
        throw new BadRequestError(
          `This room has a capacity of ${room.capacity} guest(s). ` +
            `For ${guestsCount} guest(s), you need to book at least ${roomsRequired} room(s). ` +
            `Currently requesting ${roomsNeeded} room(s).`,
        );
      }

      // Check room availability
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

      // Calculate nights and total price
      numberOfNights = calculateNights(checkInDate, checkOutDate);
      calculatedTotalPrice = calculateRoomBookingPrice(
        room.pricePerNight,
        numberOfNights,
        roomsNeeded,
      );

      // Calculate payment deadline
      const deadlineInfo = calculatePaymentDeadline(checkInDate);
      paymentDeadline = deadlineInfo.deadline;
      requiresImmediatePayment = deadlineInfo.requiresImmediatePayment;
    }

    // Handle Flight Booking
    if (flightId) {
      flight = await prisma.flight.findUnique({ where: { id: flightId } });
      if (!flight) throw new NotFoundError('Flight not found');

      const seatsNeeded = numberOfGuests || 1;

      if (flight.seatsAvailable < seatsNeeded) {
        throw new BadRequestError(
          `Only ${flight.seatsAvailable} seat(s) available on this flight. ` +
            `You requested ${seatsNeeded} seat(s).`,
        );
      }

      if (flight.status === 'CANCELLED') {
        throw new BadRequestError('This flight has been cancelled');
      }

      calculatedTotalPrice = flight.price * seatsNeeded;

      const deadlineInfo = calculatePaymentDeadline(flight.departure);
      paymentDeadline = deadlineInfo.deadline;
      requiresImmediatePayment = deadlineInfo.requiresImmediatePayment;
    }

    const booking = await prisma.$transaction(async (tx) => {
      if (tourId && tour) {
        const guestsToBook = numberOfGuests || 1;
        await tx.tour.update({
          data: { guestsBooked: { increment: guestsToBook } },
          where: { id: tourId },
        });
      }

      if (flightId && flight) {
        const seatsNeeded = numberOfGuests || 1;
        await tx.flight.update({
          data: { seatsAvailable: { decrement: seatsNeeded } },
          where: { id: flightId },
        });
      }

      return await tx.booking.create({
        data: {
          endDate: roomId ? new Date(endDate!) : null,
          flight: flightId ? { connect: { id: flightId } } : undefined,
          numberOfGuests: numberOfGuests || 1,
          numberOfNights: roomId ? numberOfNights : 1,
          numberOfRooms: roomId ? numberOfRooms || 1 : 1,
          paymentDeadline: paymentDeadline,
          requiresImmediatePayment: requiresImmediatePayment,
          room: roomId ? { connect: { id: roomId } } : undefined,

          specialRequests: specialRequests || null,
          startDate: roomId ? new Date(startDate!) : null,
          status: 'PENDING',
          totalPrice: calculatedTotalPrice,
          tour: tourId ? { connect: { id: tourId } } : undefined,
          user: { connect: { id: userId } },
        },
        include: bookingInclude,
      });
    });

    // Use the helper function to format the response
    const response = formatBookingResponse(booking);

    res.status(HTTP_STATUS_CODES.CREATED).json({
      data: {
        ...response,
        bookingDetails: {
          calculatedPrice: calculatedTotalPrice,
          paymentDeadline,
          requiresImmediatePayment,
          ...(roomId && { numberOfNights }),
          ...(tourId && tour && { tourStartDate: tour.startDate }),
          ...(flightId && flight && { flightDeparture: flight.departure }),
        },
      },
      message: 'Booking created successfully',
    });
  },
);

export const createBooking: RequestHandler[] = [
  ...validationMiddleware.create(createBookingValidation),
  handleCreateBooking,
];

/**
 * Get a single booking by ID
 */
const handleGetBooking = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { id } = req.params;
    const user = req.user;

    if (!user) {
      throw new UnauthorizedError('Unauthorized, no user provided');
    }

    const booking = await prisma.booking.findUnique({
      include: bookingInclude,
      where: { id: parseInt(id) },
    });

    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    if (user.role === 'CUSTOMER' && booking.userId !== user.id) {
      throw new UnauthorizedError('You can only view your own bookings');
    }

    const response = formatBookingResponse(booking);

    res.status(HTTP_STATUS_CODES.OK).json({
      data: response,
      message: 'Booking retrieved successfully',
    });
  },
);

export const getBooking: RequestHandler[] = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Booking ID must be a positive integer'),
  ...validationMiddleware.create([]),
  handleGetBooking,
];

/**
 * Update a booking
 */
const handleUpdateBooking = asyncHandler(
  async (
    req: Request<{ id?: string }, {}, Partial<IBookingInput>>,
    res: Response,
    _next: NextFunction,
  ): Promise<void> => {
    const { id } = req.params;
    const {
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
      userId,
    } = req.body;

    if (!id) {
      throw new BadRequestError('Booking ID is required');
    }

    const bookingId = parseInt(id);
    if (isNaN(bookingId)) {
      throw new BadRequestError('Invalid booking ID format');
    }

    const existingBooking = await prisma.booking.findUnique({
      include: {
        flight: true,
        payment: true,
        room: true,
        tour: true,
      },
      where: { id: bookingId },
    });

    if (!existingBooking) {
      throw new NotFoundError('Booking not found');
    }

    if (
      status === 'PENDING' &&
      existingBooking.payment?.status === 'COMPLETED'
    ) {
      throw new BadRequestError(
        'Cannot change booking status to PENDING when payment is completed',
      );
    }

    if (
      status === 'CANCELLED' &&
      existingBooking.payment?.status === 'COMPLETED'
    ) {
      throw new BadRequestError(
        'Cannot cancel booking when payment is completed. Please request a refund instead.',
      );
    }

    if (
      (status === 'CONFIRMED' || status === 'COMPLETED') &&
      (!existingBooking.payment ||
        existingBooking.payment.status !== 'COMPLETED')
    ) {
      throw new BadRequestError(
        `Cannot change booking status to ${status} without a completed payment`,
      );
    }

    if (status && status !== existingBooking.status) {
      const validTransitions: Record<string, string[]> = {
        CANCELLED: [],
        COMPLETED: [],
        CONFIRMED: ['COMPLETED', 'CANCELLED'],
        PENDING: ['CONFIRMED', 'CANCELLED'],
      };

      const allowedStatuses = validTransitions[existingBooking.status] || [];
      if (!allowedStatuses.includes(status)) {
        throw new BadRequestError(
          `Cannot transition booking status from ${existingBooking.status} to ${status}`,
        );
      }
    }

    if (
      (existingBooking.status === 'COMPLETED' ||
        existingBooking.status === 'CANCELLED') &&
      (tourId || roomId || flightId || userId || numberOfGuests)
    ) {
      throw new BadRequestError(
        `Cannot modify ${existingBooking.status.toLowerCase()} bookings`,
      );
    }

    let calculatedTotalPrice = totalPrice;
    let numberOfNights = existingBooking.numberOfNights;
    let paymentDeadline = existingBooking.paymentDeadline;
    let requiresImmediatePayment = existingBooking.requiresImmediatePayment;

    const updatedBooking = await prisma.$transaction(async (tx) => {
      if (userId) {
        const targetUser = await tx.user.findUnique({
          where: { id: userId },
        });
        if (!targetUser) throw new NotFoundError('User not found');
      }

      if (
        tourId &&
        (tourId !== existingBooking.tourId || numberOfGuests !== undefined)
      ) {
        const tour = await tx.tour.findUnique({ where: { id: tourId } });
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

        if (tour.status === 'CANCELLED') {
          throw new BadRequestError('This tour has been cancelled');
        }
        if (tour.status === 'COMPLETED') {
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
          if (guestDifference !== 0) {
            await tx.tour.update({
              data: {
                guestsBooked:
                  guestDifference > 0
                    ? { increment: guestDifference }
                    : { decrement: Math.abs(guestDifference) },
              },
              where: { id: tourId },
            });
          }
        } else {
          await tx.tour.update({
            data: { guestsBooked: { increment: guestsToBook } },
            where: { id: tourId },
          });
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
        if (guestDifference !== 0) {
          await tx.tour.update({
            data: {
              guestsBooked:
                guestDifference > 0
                  ? { increment: guestDifference }
                  : { decrement: Math.abs(guestDifference) },
            },
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
        const room = await tx.room.findUnique({ where: { id: roomId } });
        if (!room) throw new NotFoundError('Room not found');

        const checkInDate = startDate
          ? new Date(startDate)
          : existingBooking.startDate!;
        const checkOutDate = endDate
          ? new Date(endDate)
          : existingBooking.endDate!;

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

        const availability = await checkRoomAvailability(
          roomId,
          checkInDate,
          checkOutDate,
          roomsNeeded,
        );

        let adjustedAvailableRooms = availability.availableRooms;
        if (roomId === existingBooking.roomId) {
          adjustedAvailableRooms += existingBooking.numberOfRooms;
        }

        if (adjustedAvailableRooms < roomsNeeded) {
          throw new BadRequestError(
            `Only ${adjustedAvailableRooms} room(s) available for the selected dates. ` +
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
        const flight = await tx.flight.findUnique({
          where: { id: flightId },
        });
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

        if (flight.status === 'CANCELLED') {
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
          if (seatDifference !== 0) {
            await tx.flight.update({
              data: {
                seatsAvailable:
                  seatDifference > 0
                    ? { decrement: seatDifference }
                    : { increment: Math.abs(seatDifference) },
              },
              where: { id: flightId },
            });
          }
        } else {
          await tx.flight.update({
            data: { seatsAvailable: { decrement: seatsNeeded } },
            where: { id: flightId },
          });
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
        if (seatDifference !== 0) {
          await tx.flight.update({
            data: {
              seatsAvailable:
                seatDifference > 0
                  ? { decrement: seatDifference }
                  : { increment: Math.abs(seatDifference) },
            },
            where: { id: existingBooking.flightId },
          });
        }

        calculatedTotalPrice = flight.price * seatsNeeded;
      }

      return await tx.booking.update({
        data: {
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
          user: userId ? { connect: { id: userId } } : undefined,
        },
        include: bookingInclude,
        where: { id: bookingId },
      });
    });

    const response = formatBookingResponse(updatedBooking);

    res.status(HTTP_STATUS_CODES.OK).json({
      data: response,
      message: 'Booking updated successfully',
    });
  },
);

export const updateBooking: RequestHandler[] = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Booking ID must be a positive integer'),
  ...validationMiddleware.create(updateBookingValidation),
  handleUpdateBooking,
];

/**
 * Delete a booking
 */
export const deleteBooking = asyncHandler(
  async (
    req: Request<{ id?: string }>,
    res: Response,
    _next: NextFunction,
  ): Promise<void> => {
    const { id } = req.params;
    const user = req.user;

    if (!user) {
      throw new UnauthorizedError('Unauthorized, no user provided');
    }

    if (user.role !== 'ADMIN' && user.role !== 'AGENT') {
      throw new UnauthorizedError('Only admins and agents can delete bookings');
    }

    if (!id) {
      throw new BadRequestError('Booking ID is required');
    }

    const bookingId = parseInt(id);
    if (isNaN(bookingId)) {
      throw new BadRequestError('Invalid booking ID format');
    }

    const booking = await prisma.booking.findUnique({
      include: {
        payment: true,
        user: {
          select: { email: true, id: true, name: true },
        },
      },
      where: { id: bookingId },
    });

    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    if (booking.status === 'COMPLETED') {
      throw new BadRequestError('Completed bookings cannot be deleted');
    }

    if (booking.payment) {
      const paymentStatus = booking.payment.status;

      if (paymentStatus === 'COMPLETED') {
        throw new BadRequestError(
          'Cannot delete booking with completed payment. Please process a refund first or update payment status to PENDING.',
        );
      }

      const allowedPaymentStatuses = [
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

    if (booking.status === 'CONFIRMED' && booking.bookingDate) {
      const bookingDate = new Date(booking.bookingDate);
      const currentDate = new Date();

      if (bookingDate < currentDate) {
        throw new BadRequestError(
          'Cannot delete past confirmed bookings. Please cancel the booking instead.',
        );
      }
    }

    await prisma.$transaction(async (tx) => {
      if (booking.tourId) {
        const tour = await tx.tour.findUnique({
          where: { id: booking.tourId },
        });

        if (tour && tour.guestsBooked > 0) {
          await tx.tour.update({
            data: { guestsBooked: { decrement: booking.numberOfGuests } },
            where: { id: booking.tourId },
          });
        }
      }

      if (booking.flightId) {
        const flight = await tx.flight.findUnique({
          where: { id: booking.flightId },
        });

        if (flight && flight.seatsAvailable < flight.capacity) {
          await tx.flight.update({
            data: { seatsAvailable: { increment: booking.numberOfGuests } },
            where: { id: booking.flightId },
          });
        }
      }

      if (
        booking.payment &&
        ['CANCELLED', 'FAILED', 'PENDING'].includes(booking.payment.status)
      ) {
        await tx.payment.delete({
          where: { id: booking.payment.id },
        });
      }

      // Delete the booking
      await tx.booking.delete({
        where: { id: bookingId },
      });
    });

    res.status(HTTP_STATUS_CODES.OK).json({
      data: {
        deletedBookingId: bookingId,
        restoredAvailability: {
          flight: booking.flightId ? true : false,
          room: booking.roomId ? 'date-based' : false,
          tour: booking.tourId ? true : false,
        },
        restoredQuantities: {
          flightSeats: booking.flightId ? booking.numberOfGuests : 0,
          tourGuests: booking.tourId ? booking.numberOfGuests : 0,
        },
      },
      message: 'Booking deleted successfully',
    });
  },
);

/**
 * Get all bookings for a specific user
 */
export const getUserBookings = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { userId } = req.params;
    const user = req.user;

    if (!user) {
      throw new UnauthorizedError('Unauthorized, no user provided');
    }

    const parsedUserId = parseInt(userId, 10);
    if (isNaN(parsedUserId) || parsedUserId <= 0) {
      throw new BadRequestError('Invalid user ID');
    }

    if (user.role === 'CUSTOMER' && user.id !== parsedUserId) {
      throw new UnauthorizedError('You can only view your own bookings');
    }

    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.max(
      1,
      Math.min(100, parseInt(req.query.limit as string, 10) || 10),
    );
    const skip = (page - 1) * limit;

    const status = req.query.status as string | undefined;
    if (
      status &&
      !['CANCELLED', 'COMPLETED', 'CONFIRMED', 'PENDING'].includes(status)
    ) {
      throw new BadRequestError('Invalid booking status');
    }

    const bookingType = req.query.type as string | undefined;
    if (bookingType && !['FLIGHT', 'ROOM', 'TOUR'].includes(bookingType)) {
      throw new BadRequestError('Invalid booking type');
    }

    const search = req.query.search as string | undefined;
    const sanitizedSearch = search?.trim().slice(0, 100);

    let parsedTourId: number | undefined;
    let parsedRoomId: number | undefined;
    let parsedFlightId: number | undefined;

    if (req.query.tourId) {
      parsedTourId = parseInt(req.query.tourId as string, 10);
      if (isNaN(parsedTourId) || parsedTourId <= 0) {
        throw new BadRequestError('Invalid tour ID');
      }
    }

    if (req.query.roomId) {
      parsedRoomId = parseInt(req.query.roomId as string, 10);
      if (isNaN(parsedRoomId) || parsedRoomId <= 0) {
        throw new BadRequestError('Invalid room ID');
      }
    }

    if (req.query.flightId) {
      parsedFlightId = parseInt(req.query.flightId as string, 10);
      if (isNaN(parsedFlightId) || parsedFlightId <= 0) {
        throw new BadRequestError('Invalid flight ID');
      }
    }

    let parsedFromDate: Date | undefined;
    let parsedToDate: Date | undefined;

    if (req.query.fromDate) {
      parsedFromDate = new Date(req.query.fromDate as string);
      if (isNaN(parsedFromDate.getTime())) {
        throw new BadRequestError('Invalid fromDate format');
      }
    }

    if (req.query.toDate) {
      parsedToDate = new Date(req.query.toDate as string);
      if (isNaN(parsedToDate.getTime())) {
        throw new BadRequestError('Invalid toDate format');
      }
    }

    if (parsedFromDate && parsedToDate && parsedFromDate > parsedToDate) {
      throw new BadRequestError('fromDate cannot be after toDate');
    }

    const whereClause: any = {
      userId: parsedUserId,
    };

    if (status) {
      whereClause.status = status;
    }

    if (parsedTourId) {
      whereClause.tourId = parsedTourId;
    }

    if (parsedRoomId) {
      whereClause.roomId = parsedRoomId;
    }

    if (parsedFlightId) {
      whereClause.flightId = parsedFlightId;
    }

    if (parsedFromDate && parsedToDate) {
      whereClause.bookingDate = {
        gte: parsedFromDate,
        lte: parsedToDate,
      };
    } else if (parsedFromDate) {
      whereClause.bookingDate = {
        gte: parsedFromDate,
      };
    } else if (parsedToDate) {
      whereClause.bookingDate = {
        lte: parsedToDate,
      };
    }

    if (bookingType === 'TOUR') {
      whereClause.tourId = { not: null };
    } else if (bookingType === 'ROOM') {
      whereClause.roomId = { not: null };
    } else if (bookingType === 'FLIGHT') {
      whereClause.flightId = { not: null };
    }

    if (sanitizedSearch) {
      whereClause.OR = [
        {
          tour: {
            name: { contains: sanitizedSearch, mode: 'insensitive' },
          },
        },
        {
          tour: {
            description: { contains: sanitizedSearch, mode: 'insensitive' },
          },
        },
        {
          room: {
            roomType: { contains: sanitizedSearch, mode: 'insensitive' },
          },
        },
        {
          room: {
            description: { contains: sanitizedSearch, mode: 'insensitive' },
          },
        },
        {
          room: {
            hotel: {
              name: { contains: sanitizedSearch, mode: 'insensitive' },
            },
          },
        },
        {
          room: {
            hotel: {
              description: { contains: sanitizedSearch, mode: 'insensitive' },
            },
          },
        },
        {
          flight: {
            flightNumber: { contains: sanitizedSearch, mode: 'insensitive' },
          },
        },
        {
          flight: {
            airline: { contains: sanitizedSearch, mode: 'insensitive' },
          },
        },
        {
          user: {
            name: { contains: sanitizedSearch, mode: 'insensitive' },
          },
        },
        {
          user: {
            email: { contains: sanitizedSearch, mode: 'insensitive' },
          },
        },
      ];
    }

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        include: bookingInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        where: whereClause,
      }),
      prisma.booking.count({ where: whereClause }),
    ]);

    const response: IBooking[] = bookings.map(formatBookingResponse);

    res.status(HTTP_STATUS_CODES.OK).json({
      data: response,
      message: `Bookings for user ${parsedUserId} retrieved successfully`,
      meta: {
        limit,
        page,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  },
);

/**
 * Get all bookings with pagination
 */
const handleGetAllBookings = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const user = req.user;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    if (!user) {
      throw new UnauthorizedError('Unauthorized, no user provided');
    }

    const userId = req.query.userId as string | undefined;
    const status = req.query.status as string | undefined;
    const bookingType = req.query.type as string | undefined;
    const search = req.query.search as string | undefined;
    const tourId = req.query.tourId as string | undefined;
    const roomId = req.query.roomId as string | undefined;
    const flightId = req.query.flightId as string | undefined;
    const fromDate = req.query.fromDate as string | undefined;
    const toDate = req.query.toDate as string | undefined;

    const whereClause: any = {};

    if (user.role === 'CUSTOMER') {
      whereClause.userId = user.id;
    }

    if (userId && user.role !== 'CUSTOMER') {
      whereClause.userId = parseInt(userId);
    }

    if (status) {
      whereClause.status = status;
    }

    if (tourId) {
      whereClause.tourId = parseInt(tourId);
    }

    if (roomId) {
      whereClause.roomId = parseInt(roomId);
    }

    if (flightId) {
      whereClause.flightId = parseInt(flightId);
    }

    if (fromDate && toDate) {
      whereClause.bookingDate = {
        gte: new Date(fromDate),
        lte: new Date(toDate),
      };
    } else if (fromDate) {
      whereClause.bookingDate = {
        gte: new Date(fromDate),
      };
    } else if (toDate) {
      whereClause.bookingDate = {
        lte: new Date(toDate),
      };
    }

    if (bookingType === 'TOUR') {
      whereClause.tourId = { not: null };
    } else if (bookingType === 'ROOM') {
      whereClause.roomId = { not: null };
    } else if (bookingType === 'FLIGHT') {
      whereClause.flightId = { not: null };
    }

    if (search) {
      whereClause.OR = [
        {
          tour: {
            name: { contains: search, mode: 'insensitive' },
          },
        },
        {
          tour: {
            description: { contains: search, mode: 'insensitive' },
          },
        },
        {
          room: {
            roomType: { contains: search, mode: 'insensitive' },
          },
        },
        {
          room: {
            description: { contains: search, mode: 'insensitive' },
          },
        },
        {
          room: {
            hotel: {
              name: { contains: search, mode: 'insensitive' },
            },
          },
        },
        {
          room: {
            hotel: {
              description: { contains: search, mode: 'insensitive' },
            },
          },
        },
        {
          flight: {
            flightNumber: { contains: search, mode: 'insensitive' },
          },
        },
        {
          flight: {
            airline: { contains: search, mode: 'insensitive' },
          },
        },
        {
          user: {
            name: { contains: search, mode: 'insensitive' },
          },
        },
        {
          user: {
            email: { contains: search, mode: 'insensitive' },
          },
        },
      ];
    }

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        include: bookingInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        where: whereClause,
      }),
      prisma.booking.count({ where: whereClause }),
    ]);

    const response: IBooking[] = bookings.map(formatBookingResponse);

    res.status(HTTP_STATUS_CODES.OK).json({
      data: response,
      message: 'Bookings retrieved successfully',
      meta: {
        limit,
        page,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  },
);

export const getAllBookings: RequestHandler[] = [
  ...validationMiddleware.create(getBookingsValidation),
  handleGetAllBookings,
];

/**
 * Delete all bookings
 */
export const deleteAllBookings = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const user = req.user;

    if (!user) {
      throw new UnauthorizedError('Unauthorized access');
    }

    if (user.role !== 'ADMIN') {
      throw new UnauthorizedError('Admin privileges required');
    }

    const bookingCount = await prisma.booking.count();

    if (bookingCount === 0) {
      throw new BadRequestError('No bookings to delete');
    }

    const bookings = await prisma.booking.findMany({
      include: {
        flight: true,
        payment: true,
        room: true,
        tour: true,
      },
    });

    // Validation arrays
    const completedBookings: number[] = [];
    const confirmedBookings: number[] = [];
    const bookingsWithCompletedPayment: number[] = [];
    const bookingsWithPendingPayment: number[] = [];
    const futureActiveBookings: number[] = [];

    const now = new Date();

    // Check each booking for blocking conditions
    bookings.forEach((booking) => {
      // Check for completed bookings
      if (booking.status === 'COMPLETED') {
        completedBookings.push(booking.id);
      }

      // Check for confirmed bookings
      if (booking.status === 'CONFIRMED') {
        confirmedBookings.push(booking.id);
      }

      // Check for bookings with completed payments
      if (booking.payment && booking.payment.status === 'COMPLETED') {
        bookingsWithCompletedPayment.push(booking.id);
      }

      // Check for bookings with pending payments
      if (booking.payment && booking.payment.status === 'PENDING') {
        bookingsWithPendingPayment.push(booking.id);
      }

      // Check for future active bookings (PENDING or CONFIRMED with future dates)
      if (['CONFIRMED', 'PENDING'].includes(booking.status)) {
        let isFutureBooking = false;

        if (booking.tour && booking.tour.startDate > now) {
          isFutureBooking = true;
        } else if (booking.flight && booking.flight.departure > now) {
          isFutureBooking = true;
        } else if (
          booking.room &&
          booking.startDate &&
          booking.startDate > now
        ) {
          isFutureBooking = true;
        }

        if (isFutureBooking) {
          futureActiveBookings.push(booking.id);
        }
      }
    });

    // Build error message for blocking conditions
    const blockingIssues: string[] = [];

    if (completedBookings.length > 0) {
      blockingIssues.push(
        `${completedBookings.length} completed booking${completedBookings.length > 1 ? 's' : ''}`,
      );
    }

    if (confirmedBookings.length > 0) {
      blockingIssues.push(
        `${confirmedBookings.length} confirmed booking${confirmedBookings.length > 1 ? 's' : ''}`,
      );
    }

    if (bookingsWithCompletedPayment.length > 0) {
      blockingIssues.push(
        `${bookingsWithCompletedPayment.length} paid booking${bookingsWithCompletedPayment.length > 1 ? 's' : ''}`,
      );
    }

    if (bookingsWithPendingPayment.length > 0) {
      blockingIssues.push(
        `${bookingsWithPendingPayment.length} booking${bookingsWithPendingPayment.length > 1 ? 's' : ''} with pending payment${bookingsWithPendingPayment.length > 1 ? 's' : ''}`,
      );
    }

    if (futureActiveBookings.length > 0) {
      blockingIssues.push(
        `${futureActiveBookings.length} future active booking${futureActiveBookings.length > 1 ? 's' : ''}`,
      );
    }

    // If any blocking issues exist, throw error
    if (blockingIssues.length > 0) {
      throw new CustomError(
        HTTP_STATUS_CODES.CONFLICT,
        `Cannot delete bookings: ${blockingIssues.join(', ')} must be cancelled or refunded first`,
      );
    }

    // Calculate restoration quantities before deletion
    let totalRestoredGuests = 0;
    let totalRestoredSeats = 0;

    // All bookings can be deleted - proceed with transaction
    await prisma.$transaction(async (tx) => {
      for (const booking of bookings) {
        // Restore tour guests
        if (booking.tourId && booking.tour) {
          const guestsToRestore = booking.numberOfGuests || 1;
          if (booking.tour.guestsBooked >= guestsToRestore) {
            await tx.tour.update({
              data: { guestsBooked: { decrement: guestsToRestore } },
              where: { id: booking.tourId },
            });
            totalRestoredGuests += guestsToRestore;
          }
        }

        // Restore flight seats
        if (booking.flightId && booking.flight) {
          const seatsToRestore = booking.numberOfGuests || 1;
          if (
            booking.flight.seatsAvailable + seatsToRestore <=
            booking.flight.capacity
          ) {
            await tx.flight.update({
              data: { seatsAvailable: { increment: seatsToRestore } },
              where: { id: booking.flightId },
            });
            totalRestoredSeats += seatsToRestore;
          }
        }
      }

      // Delete all bookings
      await tx.booking.deleteMany({});
    });

    res.status(HTTP_STATUS_CODES.OK).json({
      data: {
        deletedCount: bookings.length,
        restoredGuests: totalRestoredGuests,
        restoredSeats: totalRestoredSeats,
      },
      message: `Successfully deleted ${bookings.length} booking${bookings.length > 1 ? 's' : ''}`,
    });
  },
);
