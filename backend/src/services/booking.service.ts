import { HTTP_STATUS_CODES } from '#config/constants.js';
import {
  BookingStatus,
  type Flight,
  FlightStatus,
  PaymentStatus,
  type Prisma,
  type Room,
  type Tour,
  TourStatus,
} from '#config/prismaClient.js';
import {
  BadRequestError,
  CustomError,
  NotFoundError,
  UnauthorizedError,
} from '#middlewares/error-handler.js';
import { type AppDeps, defaultDeps } from '#services/deps.js';
// src/services/booking.service.ts
//
// Bookings domain logic, extracted from the legacy fat controller. Pure, DI'd
// functions: they take typed inputs, own every Prisma access and domain
// invariant (per-type availability and capacity guards, payment deadlines,
// the status transition map, payment-aware update/delete guards, tour-guest
// and flight-seat accounting), throw the typed CustomError subclasses and
// never touch req/res. The legacy utils/bookingHelpers.ts functions were
// absorbed here (with the clock injected instead of `new Date()`).
//
// Authorization note: unlike other domains, the booking role rules are NOT
// duplicated by routes/booking.ts (authorizeRole admits ADMIN/AGENT/CUSTOMER
// on most routes), so the legacy in-handler checks are preserved as explicit
// actor-based rules — customers may only create/read their own bookings, only
// admins/agents may delete, only admins may bulk-delete. Functions that had
// no in-handler rule (updateBooking) keep having none, as before.
//
// Transaction note (preserved from the legacy handlers): createBooking runs
// its existence/availability checks OUTSIDE the transaction and only wraps
// the counter updates + booking.create; updateBooking wraps its whole flow in
// one transaction but the room-availability read inside it deliberately uses
// the non-tx client (the legacy helper closed over the global prisma);
// deleteBooking/deleteAllBookings check guards outside and wrap the
// restore-counters + delete writes.
import { type IUser, UserRole } from '#types/user-profile.types.js';
import {
  bookingInclude,
  type BookingWithRelations,
} from '#utils/mappers/booking.mapper.js';

/** Booking "type" filter values — derived from which relation is set. */
export const BOOKING_TYPES = ['FLIGHT', 'ROOM', 'TOUR'] as const;

export type BookingActor = Pick<IUser, 'id' | 'role'>;

export interface BookingCreateInput {
  /** The customer the booking is FOR: customers must self-book (actor rule);
   * admins/agents may book on behalf of any customer. */
  customerId: number;
  endDate?: string;
  flightId?: number;
  numberOfGuests?: number;
  numberOfRooms?: number;
  roomId?: number;
  specialRequests?: null | string;
  startDate?: string;
  totalPrice: number;
  tourId?: number;
}

export interface BookingCreateResult {
  booking: BookingWithRelations;
  details: BookingCreationDetails;
}

/** Extra `bookingDetails` block the create response carries. */
export interface BookingCreationDetails {
  calculatedPrice: number;
  flightDeparture?: Date;
  numberOfNights?: number;
  paymentDeadline: Date | null;
  requiresImmediatePayment: boolean;
  tourStartDate?: Date;
}

export interface BookingDeleteSummary {
  deletedBookingId: number;
  restoredAvailability: {
    flight: boolean;
    room: 'date-based' | false;
    tour: boolean;
  };
  restoredQuantities: {
    flightSeats: number;
    tourGuests: number;
  };
}

export interface BookingListParams {
  /** Filter by owner; ignored for customers (always scoped to themselves). */
  customerId?: number;
  flightId?: number;
  /** Raw date strings, parsed here the way the legacy handler did. */
  fromDate?: string;
  limit: number;
  page: number;
  roomId?: number;
  search?: string;
  status?: BookingStatus;
  toDate?: string;
  tourId?: number;
  type?: BookingType;
}

export type BookingType = (typeof BOOKING_TYPES)[number];

export interface BookingUpdateInput {
  customerId?: number;
  endDate?: string;
  flightId?: number;
  numberOfGuests?: number;
  numberOfRooms?: number;
  roomId?: number;
  specialRequests?: null | string;
  startDate?: string;
  status?: BookingStatus;
  totalPrice?: number;
  tourId?: number;
}

export interface BulkBookingDeleteSummary {
  deletedCount: number;
  restoredGuests: number;
  restoredSeats: number;
}

const DAY_MS = 1000 * 60 * 60 * 24;
const HOUR_MS = 1000 * 60 * 60;

/** Allowed booking-status transitions; terminal states allow none. */
const VALID_STATUS_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  CANCELLED: [],
  COMPLETED: [],
  CONFIRMED: [BookingStatus.COMPLETED, BookingStatus.CANCELLED],
  PENDING: [BookingStatus.CONFIRMED, BookingStatus.CANCELLED],
};

/** Nights between two dates, midnight-to-midnight (legacy bookingHelpers). */
const calculateNights = (startDate: Date, endDate: Date): number => {
  const start = new Date(startDate);
  const end = new Date(endDate);

  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  return Math.ceil((end.getTime() - start.getTime()) / DAY_MS);
};

/** Total price for a room stay (legacy bookingHelpers). */
const calculateRoomBookingPrice = (
  pricePerNight: number,
  numberOfNights: number,
  numberOfRooms: number,
): number => pricePerNight * numberOfNights * numberOfRooms;

export const makeBookingService = (
  d: Pick<AppDeps, 'clock' | 'prisma'>,
) => {
  const { clock, prisma } = d;

  /**
   * Payment deadline tiers by proximity to check-in (legacy bookingHelpers):
   * within 2 hours → 30 minutes from now (immediate), within 24 hours →
   * 2 hours from now (immediate), otherwise 24 hours before check-in.
   */
  const calculatePaymentDeadline = (
    checkInDate: Date,
  ): { deadline: Date; requiresImmediatePayment: boolean } => {
    const now = clock.now();
    const hoursUntilCheckIn = (checkInDate.getTime() - now.getTime()) / HOUR_MS;

    if (hoursUntilCheckIn <= 2) {
      return {
        deadline: new Date(now.getTime() + 30 * 60 * 1000),
        requiresImmediatePayment: true,
      };
    } else if (hoursUntilCheckIn <= 24) {
      return {
        deadline: new Date(now.getTime() + 2 * HOUR_MS),
        requiresImmediatePayment: true,
      };
    }

    const deadline = new Date(checkInDate);
    deadline.setHours(deadline.getHours() - 24);
    return { deadline, requiresImmediatePayment: false };
  };

  /** Stay-date sanity checks (legacy bookingHelpers), day-granular. */
  const validateBookingDates = (
    startDate: Date,
    endDate: Date,
  ): { error?: string; valid: boolean } => {
    const now = clock.now();
    now.setHours(0, 0, 0, 0);

    const checkIn = new Date(startDate);
    checkIn.setHours(0, 0, 0, 0);

    const checkOut = new Date(endDate);
    checkOut.setHours(0, 0, 0, 0);

    if (checkIn < now) {
      return { error: 'Check-in date cannot be in the past', valid: false };
    }

    if (checkOut <= checkIn) {
      return {
        error: 'Check-out date must be after check-in date',
        valid: false,
      };
    }

    if (calculateNights(checkIn, checkOut) < 1) {
      return { error: 'Booking must be for at least 1 night', valid: false };
    }

    return { valid: true };
  };

  /**
   * Rooms still free for a window: totalRooms minus rooms held by PENDING or
   * CONFIRMED bookings whose stay overlaps it (legacy bookingHelpers — note
   * the inclusive lte/gte overlap, unlike room.service's lt/gt variant).
   */
  const checkRoomAvailability = async (
    roomId: number,
    startDate: Date,
    endDate: Date,
    numberOfRoomsNeeded: number,
  ): Promise<{ available: boolean; availableRooms: number }> => {
    // findFirst so a soft-deleted room reads as unavailable.
    const room = await prisma.room.findFirst({ where: { id: roomId } });
    if (!room) {
      return { available: false, availableRooms: 0 };
    }

    const overlappingBookings = await prisma.booking.findMany({
      select: { numberOfRooms: true },
      where: {
        OR: [
          {
            AND: [
              { startDate: { lte: endDate } },
              { endDate: { gte: startDate } },
            ],
          },
        ],
        roomId: roomId,
        status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
      },
    });

    const roomsBookedDuringPeriod = overlappingBookings.reduce(
      (sum, booking) => sum + booking.numberOfRooms,
      0,
    );

    const availableRooms = room.totalRooms - roomsBookedDuringPeriod;

    return {
      available: availableRooms >= numberOfRoomsNeeded,
      availableRooms,
    };
  };

  /** The tour/room/hotel/flight/user text-search OR list (legacy, verbatim). */
  const buildSearchOr = (
    search: string,
  ): Prisma.BookingWhereInput['OR'] => [
    { tour: { name: { contains: search, mode: 'insensitive' } } },
    { tour: { description: { contains: search, mode: 'insensitive' } } },
    { room: { roomType: { contains: search, mode: 'insensitive' } } },
    { room: { description: { contains: search, mode: 'insensitive' } } },
    { room: { hotel: { name: { contains: search, mode: 'insensitive' } } } },
    {
      room: {
        hotel: { description: { contains: search, mode: 'insensitive' } },
      },
    },
    { flight: { flightNumber: { contains: search, mode: 'insensitive' } } },
    { flight: { airline: { contains: search, mode: 'insensitive' } } },
    { customer: { name: { contains: search, mode: 'insensitive' } } },
    { customer: { email: { contains: search, mode: 'insensitive' } } },
  ];

  /**
   * Shared filter block: status, item-id filters, bookingDate window, then
   * the type filter (which — as in the legacy handlers — overrides a tourId/
   * roomId/flightId equality filter with `{ not: null }`), then search.
   */
  const applyListFilters = (
    where: Prisma.BookingWhereInput,
    params: BookingListParams,
    search: string | undefined,
  ): void => {
    if (params.status) {
      where.status = params.status;
    }

    if (params.tourId) {
      where.tourId = params.tourId;
    }

    if (params.roomId) {
      where.roomId = params.roomId;
    }

    if (params.flightId) {
      where.flightId = params.flightId;
    }

    const fromDate = params.fromDate ? new Date(params.fromDate) : undefined;
    const toDate = params.toDate ? new Date(params.toDate) : undefined;

    if (fromDate && toDate) {
      where.bookingDate = { gte: fromDate, lte: toDate };
    } else if (fromDate) {
      where.bookingDate = { gte: fromDate };
    } else if (toDate) {
      where.bookingDate = { lte: toDate };
    }

    if (params.type === 'TOUR') {
      where.tourId = { not: null };
    } else if (params.type === 'ROOM') {
      where.roomId = { not: null };
    } else if (params.type === 'FLIGHT') {
      where.flightId = { not: null };
    }

    if (search) {
      where.OR = buildSearchOr(search);
    }
  };

  const findPage = async (
    where: Prisma.BookingWhereInput,
    page: number,
    limit: number,
  ): Promise<{ bookings: BookingWithRelations[]; total: number }> => {
    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        include: bookingInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        where,
      }),
      prisma.booking.count({ where }),
    ]);

    return { bookings, total };
  };

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

      const checkInDate = new Date(startDate);
      const checkOutDate = new Date(endDate);

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
    // Note: the duplicate-booking unique constraints span soft-deleted rows
    // (khadys convention) — a soft-deleted booking still holds its
    // customer+tour/room/flight slot until it is restored or hard-purged.
    const booking = await prisma.$transaction(async (tx) => {
      if (tourId && tour) {
        const guestsToBook = numberOfGuests ?? 1;
        await tx.tour.update({
          data: { guestsBooked: { increment: guestsToBook } },
          where: { id: tourId },
        });
      }

      if (flightId && flight) {
        const seatsNeeded = numberOfGuests ?? 1;
        await tx.flight.update({
          data: { seatsAvailable: { decrement: seatsNeeded } },
          where: { id: flightId },
        });
      }

      return await tx.booking.create({
        data: {
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

  const getBookingById = async (
    actor: BookingActor,
    id: number,
  ): Promise<BookingWithRelations> => {
    const booking = await prisma.booking.findFirst({
      include: bookingInclude,
      where: { id },
    });
    if (!booking) throw new NotFoundError('Booking not found');

    if (actor.role === UserRole.CUSTOMER && booking.customerId !== actor.id) {
      throw new UnauthorizedError('You can only view your own bookings');
    }

    return booking;
  };

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
        flight: true,
        payment: true,
        room: true,
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

    return await prisma.$transaction(async (tx) => {
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
  };

  /**
   * Deletes one booking after the legacy guard chain (COMPLETED status,
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
      if (booking.tourId) {
        // findUnique on purpose (unscoped): restore the counter even when the
        // tour itself has been soft-deleted meanwhile.
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

      // Soft-delete the payment alongside the booking. Legacy removed
      // 'CANCELLED'/FAILED/PENDING payments explicitly and REFUNDED ones via
      // the Payment→Booking FK cascade; with soft deletes the payment must be
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

  /** GET /bookings — customers are always scoped to their own rows. */
  const listBookings = async (
    actor: BookingActor,
    params: BookingListParams,
  ): Promise<{ bookings: BookingWithRelations[]; total: number }> => {
    const where: Prisma.BookingWhereInput = {};

    if (actor.role === UserRole.CUSTOMER) {
      where.customerId = actor.id;
    }

    if (params.customerId && actor.role !== UserRole.CUSTOMER) {
      where.customerId = params.customerId;
    }

    applyListFilters(where, params, params.search);

    return findPage(where, params.page, params.limit);
  };

  /** GET /bookings/customer/:customerId — a customer may only list their own. */
  const listCustomerBookings = async (
    actor: BookingActor,
    customerId: number,
    params: BookingListParams,
  ): Promise<{ bookings: BookingWithRelations[]; total: number }> => {
    if (actor.role === UserRole.CUSTOMER && actor.id !== customerId) {
      throw new UnauthorizedError('You can only view your own bookings');
    }

    const where: Prisma.BookingWhereInput = { customerId };

    // The legacy handler trimmed and truncated the search term (the general
    // list endpoint used it raw); preserved.
    applyListFilters(where, params, params.search?.trim().slice(0, 100));

    return findPage(where, params.page, params.limit);
  };

  /**
   * Wipes every booking, but only when NONE of them has a blocking condition
   * (completed/confirmed status, completed/pending payment, future active
   * booking); a single blocked booking refuses the whole operation with a 409
   * summarising every issue. Counter restores and the deleteMany share one
   * transaction.
   */
  const deleteAllBookings = async (
    actor: BookingActor,
  ): Promise<BulkBookingDeleteSummary> => {
    if (actor.role !== UserRole.ADMIN) {
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

    const completedBookings: number[] = [];
    const confirmedBookings: number[] = [];
    const bookingsWithCompletedPayment: number[] = [];
    const bookingsWithPendingPayment: number[] = [];
    const futureActiveBookings: number[] = [];

    const now = clock.now();

    for (const booking of bookings) {
      if (booking.status === BookingStatus.COMPLETED) {
        completedBookings.push(booking.id);
      }

      if (booking.status === BookingStatus.CONFIRMED) {
        confirmedBookings.push(booking.id);
      }

      if (booking.payment?.status === PaymentStatus.COMPLETED) {
        bookingsWithCompletedPayment.push(booking.id);
      }

      if (booking.payment?.status === PaymentStatus.PENDING) {
        bookingsWithPendingPayment.push(booking.id);
      }

      if (
        booking.status === BookingStatus.CONFIRMED ||
        booking.status === BookingStatus.PENDING
      ) {
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
    }

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

    if (blockingIssues.length > 0) {
      throw new CustomError(
        HTTP_STATUS_CODES.CONFLICT,
        `Cannot delete bookings: ${blockingIssues.join(', ')} must be cancelled or refunded first`,
      );
    }

    let totalRestoredGuests = 0;
    let totalRestoredSeats = 0;

    await prisma.$transaction(async (tx) => {
      for (const booking of bookings) {
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

      // Soft-delete the bookings and (mirroring the legacy FK cascade) their
      // remaining FAILED/REFUNDED payments — COMPLETED/PENDING ones are
      // blocked above.
      const deletedAt = clock.now();
      await tx.payment.updateMany({
        data: { deletedAt },
        where: {
          bookingId: { in: bookings.map((b) => b.id) },
          deletedAt: null,
        },
      });
      await tx.booking.updateMany({
        data: { deletedAt },
        where: { deletedAt: null },
      });
    });

    return {
      deletedCount: bookings.length,
      restoredGuests: totalRestoredGuests,
      restoredSeats: totalRestoredSeats,
    };
  };

  return {
    createBooking,
    deleteAllBookings,
    deleteBooking,
    getBookingById,
    listBookings,
    listCustomerBookings,
    updateBooking,
  };
};

export const bookingService = makeBookingService(defaultDeps);

export const {
  createBooking,
  deleteAllBookings,
  deleteBooking,
  getBookingById,
  listBookings,
  listCustomerBookings,
  updateBooking,
} = bookingService;
