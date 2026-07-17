// src/services/booking/core.ts
//
// The shared bookings engine: payment-deadline / stay-date rules, the
// availability + concurrency-safe inventory-claim helpers (guarded atomic
// updateMany for tour slots and flight seats, a room-row lock + recount for
// rooms), the counter-restore path shared by cancel/delete/expiry, and the
// list-filter/query helpers. Built once per deps in makeBookingCore(d); each
// feature factory receives the returned BookingCore. No req/res.
import {
  BookingStatus,
  type Prisma,
  type TransactionClient,
} from '#config/prismaClient.js';
import { makeBookingNotifications } from '#notifications/booking-notifications.js';
import {
  type BookingDeps,
  type BookingListParams,
  calculateNights,
  HOUR_MS,
} from '#services/booking/shared.js';
import {
  bookingInclude,
  type BookingWithRelations,
} from '#utils/mappers/booking.mapper.js';

export type BookingCore = ReturnType<typeof makeBookingCore>;

export const makeBookingCore = (d: BookingDeps) => {
  const { clock, prisma } = d;
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
  const buildSearchOr = (search: string): Prisma.BookingWhereInput['OR'] => [
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

  return {
    applyListFilters,
    calculatePaymentDeadline,
    checkRoomAvailability,
    claimFlightSeats,
    claimTourSlots,
    findPage,
    lockAndCountRoomsHeld,
    notices,
    restoreItemCounters,
    validateBookingDates,
  };
};
