import pMap from 'p-map';

import {
  BookingStatus,
  type Flight,
  FlightStatus,
  PaymentStatus,
  type Prisma,
  type Room,
  type Tour,
  TourStatus,
  type TransactionClient,
} from '#config/prismaClient.js';
import {
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
} from '#middlewares/error-handler.js';
import { makeBookingNotifications } from '#notifications/booking-notifications.js';
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
// admins/agents may delete. Functions that had no in-handler rule
// (updateBooking) keep having none, as before.
//
// Transaction note: createBooking/updateBooking run friendly
// existence/availability pre-checks outside (or at the top of) the
// transaction for good error messages, but inventory is actually consumed by
// concurrency-safe writes inside it — guarded atomic updateMany for tour
// slots and flight seats (claimTourSlots/claimFlightSeats), and a
// room-row lock + in-transaction recount for room inventory
// (lockAndCountRoomsHeld) — so concurrent requests can never oversell.
// deleteBooking checks guards outside and wraps the restore-counters +
// delete writes.
import { type IUser, UserRole } from '#types/user-profile.types.js';
import {
  bookingInclude,
  type BookingWithRelations,
} from '#utils/mappers/booking.mapper.js';

/** Booking "type" filter values — derived from which relation is set. */
export const BOOKING_TYPES = ['FLIGHT', 'ROOM', 'TOUR'] as const;

export type BookingActor = Pick<IUser, 'id' | 'role'>;

export interface BookingCancelResult {
  booking: BookingWithRelations;
  /** True when a COMPLETED payment moved to REFUND_REQUESTED for admins to
   * action via the refund endpoint. */
  refundRequested: boolean;
}

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

export interface ExpiredBookingsSweepSummary {
  cancelledCount: number;
  failureCount: number;
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
  d: Pick<AppDeps, 'clock' | 'config' | 'logger' | 'notify' | 'prisma'>,
) => {
  const { clock, logger, prisma } = d;
  const notices = makeBookingNotifications(d);

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

  /**
   * Atomically claims tour slots inside the caller's transaction. The
   * increment only lands while it keeps guestsBooked within maxGuests, so
   * two concurrent bookings can never both pass an earlier read-then-check
   * and oversell the tour. Returns false when concurrent bookings consumed
   * the slots between the friendly pre-check and this write.
   */
  const claimTourSlots = async (
    tx: TransactionClient,
    tourId: number,
    maxGuests: number,
    guests: number,
  ): Promise<boolean> => {
    const { count } = await tx.tour.updateMany({
      data: { guestsBooked: { increment: guests } },
      where: { guestsBooked: { lte: maxGuests - guests }, id: tourId },
    });
    return count === 1;
  };

  /**
   * Atomically claims flight seats inside the caller's transaction: the
   * decrement only lands while seatsAvailable covers it, so the counter can
   * never go negative under concurrent bookings.
   */
  const claimFlightSeats = async (
    tx: TransactionClient,
    flightId: number,
    seats: number,
  ): Promise<boolean> => {
    const { count } = await tx.flight.updateMany({
      data: { seatsAvailable: { decrement: seats } },
      where: { id: flightId, seatsAvailable: { gte: seats } },
    });
    return count === 1;
  };

  /**
   * Concurrency-safe variant of checkRoomAvailability for use inside the
   * transaction that creates/updates the booking row: takes a row lock on
   * the room so concurrent bookings for it serialize, then recounts
   * overlapping holds through the transaction (a competing booking commits
   * before our count runs, or waits behind our lock). Returns the number of
   * rooms already held for the window, excluding `excludeBookingId` when the
   * booking being updated already holds rooms in it.
   */
  const lockAndCountRoomsHeld = async (
    tx: TransactionClient,
    roomId: number,
    startDate: Date,
    endDate: Date,
    excludeBookingId?: number,
  ): Promise<number> => {
    await tx.$queryRaw`SELECT id FROM "Room" WHERE id = ${roomId} FOR UPDATE`;

    const overlappingBookings = await tx.booking.findMany({
      select: { numberOfRooms: true },
      where: {
        ...(excludeBookingId !== undefined && {
          id: { not: excludeBookingId },
        }),
        endDate: { gte: startDate },
        roomId: roomId,
        startDate: { lte: endDate },
        status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
      },
    });

    return overlappingBookings.reduce(
      (sum, booking) => sum + booking.numberOfRooms,
      0,
    );
  };

  /**
   * Restores the tour-guest / flight-seat counters a booking holds, inside
   * the caller's transaction — the single cancel/delete restore path (shared
   * by deleteBooking, the customer self-cancel and the deadline-expiry
   * sweep). findUnique on purpose (unscoped): the counter is restored even
   * when the tour/flight itself has been soft-deleted meanwhile; the guards
   * keep a drifted counter from going negative / past capacity.
   */
  const restoreItemCounters = async (
    tx: TransactionClient,
    booking: {
      flightId: null | number;
      numberOfGuests: number;
      tourId: null | number;
    },
  ): Promise<void> => {
    if (booking.tourId) {
      const tour = await tx.tour.findUnique({ where: { id: booking.tourId } });
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
      await restoreItemCounters(tx, booking);

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

  return {
    cancelBooking,
    cancelExpiredBookings,
    createBooking,
    deleteBooking,
    getBookingById,
    listBookings,
    listCustomerBookings,
    updateBooking,
  };
};

export const bookingService = makeBookingService(defaultDeps);

export const {
  cancelBooking,
  cancelExpiredBookings,
  createBooking,
  deleteBooking,
  getBookingById,
  listBookings,
  listCustomerBookings,
  updateBooking,
} = bookingService;
