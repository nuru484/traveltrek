// src/services/room.service.ts
//
// Rooms domain logic, extracted from the legacy fat controller. Pure, DI'd
// functions: they take typed inputs, own every Prisma access and domain
// invariant (hotel existence, duplicate room-type checks, booking-aware
// update/delete guards, availability math, Cloudinary photo cleanup), throw
// the typed CustomError subclasses and never touch req/res.
//
// Availability math note: a room is "booked" for a window when a PENDING or
// CONFIRMED booking overlaps it (booking.startDate < end AND
// booking.endDate > start); availableRooms = totalRooms - sum(numberOfRooms)
// of those bookings. This is preserved bit-for-bit from the legacy
// getAvailableRoomsCount helper, including returning {0, 0} for a missing
// room (checkAvailability 404s afterwards, matching the legacy order).
import { HTTP_STATUS_CODES } from '../config/constants';
import {
  BookingStatus,
  PaymentStatus,
  type Prisma,
} from '../config/prismaClient';
import {
  BadRequestError,
  CustomError,
  NotFoundError,
} from '../middlewares/error-handler';
import {
  type RoomAvailabilityCounts,
  roomInclude,
  type RoomWithRelations,
} from '../utils/mappers/room.mapper';
import { type AppDeps, defaultDeps } from './deps';

/**
 * Whitelisted `sortBy` fields for room listings — the columns the legacy
 * controller ordered by (anything else fell back to createdAt desc; now it is
 * rejected at the boundary).
 */
export const ROOM_SORT_FIELDS = [
  'capacity',
  'createdAt',
  'pricePerNight',
] as const;

/** Raw start/end query strings; resolved by the legacy date-window rules. */
export interface DateWindowInput {
  endDate?: string;
  startDate?: string;
}

/** Availability report for one room over an explicit date window. */
export interface RoomAvailabilityReport {
  availableRooms: number;
  bookedRooms: number;
  endDate: Date;
  isAvailable: boolean;
  roomId: number;
  roomType: string;
  startDate: Date;
  totalRooms: number;
}

export interface RoomBulkDeleteSummary {
  deleted: number;
  hotelsAffected: number;
  skipped: number;
  skippedDetails?: {
    hotel: string;
    reasons: string[];
    roomId: number;
    roomType: string;
  }[];
  total: number;
}

export interface RoomDeleteSummary {
  deletedAt: string;
  historicalBookingsCount: number;
  hotelName: string;
  id: number;
  roomType: string;
}

export interface RoomInput {
  amenities?: string[];
  capacity: number;
  description?: string;
  hotelId: number;
  /** Cloudinary URL, already uploaded by the route's middleware. */
  photo?: string;
  pricePerNight: number;
  roomType: string;
  totalRooms: number;
}

export interface RoomListParams extends DateWindowInput {
  /** Rooms offering every one of these amenities. */
  amenities?: string[];
  hotelId?: number;
  limit: number;
  maxCapacity?: number;
  maxPrice?: number;
  minCapacity?: number;
  minPrice?: number;
  page: number;
  roomType?: string;
  sortBy: RoomSortField;
  sortOrder: 'asc' | 'desc';
}

export type RoomSortField = (typeof ROOM_SORT_FIELDS)[number];

export type RoomUpdateInput = Partial<RoomInput>;

/** A room row with the availability counts computed for the request's window. */
export interface RoomWithAvailability {
  availability: RoomAvailabilityCounts;
  room: RoomWithRelations;
}

export const makeRoomService = (
  d: Pick<AppDeps, 'clock' | 'cloudinary' | 'logger' | 'prisma'>,
) => {
  const { clock, cloudinary, logger, prisma } = d;

  /** Best-effort Cloudinary delete; a cleanup failure never fails the request. */
  const cleanupPhoto = async (
    photo: string,
    context: string,
  ): Promise<void> => {
    try {
      await cloudinary.deleteImage(photo);
    } catch (cleanupError) {
      logger.warn({ err: cleanupError, photo }, context);
    }
  };

  /**
   * Resolves the availability window the legacy way: default to
   * [now, now + 1 day], and only when BOTH dates are sent, parse and check
   * them (falsy/empty params fall back to the default, as before).
   */
  const resolveDateWindow = (
    startDate?: string,
    endDate?: string,
  ): { end: Date; start: Date } => {
    let start = clock.now();
    let end = clock.now();
    end.setDate(start.getDate() + 1);

    if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new BadRequestError('Invalid date format');
      }

      if (start >= end) {
        throw new BadRequestError('End date must be after start date');
      }
    }

    return { end, start };
  };

  /** Booked/available counts for a date range — legacy math, bit-for-bit. */
  const getAvailableRoomsCount = async (
    roomId: number,
    startDate: Date,
    endDate: Date,
  ): Promise<RoomAvailabilityCounts> => {
    const room = await prisma.room.findUnique({
      select: { totalRooms: true },
      where: { id: roomId },
    });

    if (!room) return { availableRooms: 0, bookedRooms: 0 };

    // Overlapping bookings that are CONFIRMED or PENDING.
    const overlappingBookings = await prisma.booking.findMany({
      select: { numberOfRooms: true },
      where: {
        AND: [{ startDate: { lt: endDate } }, { endDate: { gt: startDate } }],
        roomId: roomId,
        status: { in: [BookingStatus.CONFIRMED, BookingStatus.PENDING] },
      },
    });

    const bookedRooms = overlappingBookings.reduce(
      (sum, booking) => sum + booking.numberOfRooms,
      0,
    );

    return {
      availableRooms: room.totalRooms - bookedRooms,
      bookedRooms: bookedRooms,
    };
  };

  /** Availability for the default window (today through tomorrow). */
  const getCurrentAvailability = (roomId: number) => {
    const { end, start } = resolveDateWindow();
    return getAvailableRoomsCount(roomId, start, end);
  };

  const createRoom = async (input: RoomInput): Promise<RoomWithAvailability> => {
    try {
      const hotel = await prisma.hotel.findUnique({
        select: { id: true },
        where: { id: input.hotelId },
      });
      if (!hotel) throw new NotFoundError('Hotel not found');

      const existingRoom = await prisma.room.findFirst({
        where: {
          hotelId: input.hotelId,
          roomType: input.roomType.trim(),
        },
      });
      if (existingRoom) {
        throw new CustomError(
          HTTP_STATUS_CODES.CONFLICT,
          `Room type '${input.roomType}' already exists for this hotel`,
        );
      }

      const room = await prisma.room.create({
        data: {
          amenities: input.amenities ?? [],
          capacity: input.capacity,
          description: input.description ? input.description.trim() : null,
          hotel: { connect: { id: input.hotelId } },
          photo: input.photo ?? null,
          pricePerNight: input.pricePerNight,
          roomType: input.roomType.trim(),
          totalRooms: input.totalRooms,
        },
        include: roomInclude,
      });

      return { availability: await getCurrentAvailability(room.id), room };
    } catch (error) {
      // The photo was already uploaded by the route middleware; don't orphan
      // it on Cloudinary when the create is refused (the legacy handler did).
      if (input.photo) {
        await cleanupPhoto(input.photo, 'Failed to clean up Cloudinary image');
      }
      throw error;
    }
  };

  /**
   * Fetches a room with counts for the requested window. The 404 fires before
   * the date checks, matching the legacy handler's order.
   */
  const getRoomById = async (
    id: number,
    window: DateWindowInput = {},
  ): Promise<RoomWithAvailability> => {
    const room = await prisma.room.findUnique({
      include: roomInclude,
      where: { id },
    });
    if (!room) throw new NotFoundError('Room not found');

    const { end, start } = resolveDateWindow(window.startDate, window.endDate);
    return {
      availability: await getAvailableRoomsCount(room.id, start, end),
      room,
    };
  };

  const updateRoom = async (
    id: number,
    input: RoomUpdateInput,
  ): Promise<RoomWithAvailability> => {
    const uploadedPhotoUrl = input.photo;

    try {
      const existingRoom = await prisma.room.findUnique({
        include: {
          bookings: {
            select: { id: true, numberOfRooms: true, status: true },
            where: {
              OR: [
                { status: BookingStatus.PENDING },
                { status: BookingStatus.CONFIRMED },
              ],
            },
          },
        },
        where: { id },
      });
      if (!existingRoom) throw new NotFoundError('Room not found');

      const oldPhoto = existingRoom.photo;
      const hasActiveBookings = existingRoom.bookings.length > 0;
      const totalBookedRooms = existingRoom.bookings.reduce(
        (sum, booking) => sum + booking.numberOfRooms,
        0,
      );

      if (input.hotelId !== undefined && input.hotelId !== existingRoom.hotelId) {
        if (hasActiveBookings) {
          throw new BadRequestError(
            'Cannot change hotel when active bookings exist. Please cancel all bookings first or create a new room.',
          );
        }

        const hotel = await prisma.hotel.findUnique({
          select: { id: true },
          where: { id: input.hotelId },
        });
        if (!hotel) throw new NotFoundError('Hotel not found');
      }

      if (
        input.roomType !== undefined &&
        input.roomType.trim() !== existingRoom.roomType
      ) {
        if (hasActiveBookings) {
          throw new BadRequestError(
            'Cannot change room type when active bookings exist. Please cancel all bookings first or create a new room.',
          );
        }

        const duplicateRoom = await prisma.room.findFirst({
          where: {
            hotelId: input.hotelId ?? existingRoom.hotelId,
            id: { not: id },
            roomType: input.roomType.trim(),
          },
        });
        if (duplicateRoom) {
          throw new CustomError(
            HTTP_STATUS_CODES.CONFLICT,
            `Room type '${input.roomType}' already exists for this hotel`,
          );
        }
      }

      if (input.pricePerNight !== undefined && hasActiveBookings) {
        const priceChange =
          Math.abs(
            (input.pricePerNight - existingRoom.pricePerNight) /
              existingRoom.pricePerNight,
          ) * 100;
        if (priceChange > 50) {
          logger.warn(
            `Large price change (${priceChange.toFixed(2)}%) on room ${id} with active bookings`,
          );
        }
      }

      if (
        input.capacity !== undefined &&
        hasActiveBookings &&
        input.capacity < existingRoom.capacity
      ) {
        throw new BadRequestError(
          'Cannot reduce room capacity when active bookings exist. Guests may have booked based on the current capacity.',
        );
      }

      if (input.totalRooms !== undefined && input.totalRooms < totalBookedRooms) {
        throw new BadRequestError(
          `Cannot reduce total rooms to ${input.totalRooms}. ${totalBookedRooms} rooms are currently booked across all reservations. Minimum total rooms allowed is ${totalBookedRooms}.`,
        );
      }

      // Prisma ignores undefined keys, so omitted fields stay untouched.
      const data: Prisma.RoomUpdateInput = {
        amenities: input.amenities,
        capacity: input.capacity,
        description:
          input.description === undefined
            ? undefined
            : input.description.trim() || null,
        hotel:
          input.hotelId === undefined
            ? undefined
            : { connect: { id: input.hotelId } },
        photo: uploadedPhotoUrl,
        pricePerNight: input.pricePerNight,
        roomType: input.roomType?.trim(),
        totalRooms: input.totalRooms,
      };

      const updatedRoom = await prisma.room.update({
        data,
        include: roomInclude,
        where: { id },
      });

      // Replaced photo: drop the old image now that the row points elsewhere.
      if (uploadedPhotoUrl && oldPhoto && oldPhoto !== uploadedPhotoUrl) {
        await cleanupPhoto(oldPhoto, 'Failed to clean up old room photo');
      }

      return {
        availability: await getCurrentAvailability(updatedRoom.id),
        room: updatedRoom,
      };
    } catch (error) {
      // Cloudinary upload succeeded but the update was refused: clean up the
      // freshly uploaded image before rethrowing.
      if (uploadedPhotoUrl) {
        await cleanupPhoto(
          uploadedPhotoUrl,
          'Failed to clean up Cloudinary image',
        );
      }
      throw error;
    }
  };

  const buildWhere = (params: RoomListParams): Prisma.RoomWhereInput => {
    const where: Prisma.RoomWhereInput = {};

    if (params.hotelId !== undefined) {
      where.hotelId = params.hotelId;
    }

    if (params.roomType) {
      where.roomType = { contains: params.roomType, mode: 'insensitive' };
    }

    if (params.minPrice !== undefined || params.maxPrice !== undefined) {
      where.pricePerNight = {
        ...(params.minPrice !== undefined && { gte: params.minPrice }),
        ...(params.maxPrice !== undefined && { lte: params.maxPrice }),
      };
    }

    if (params.minCapacity !== undefined || params.maxCapacity !== undefined) {
      where.capacity = {
        ...(params.minCapacity !== undefined && { gte: params.minCapacity }),
        ...(params.maxCapacity !== undefined && { lte: params.maxCapacity }),
      };
    }

    if (params.amenities && params.amenities.length > 0) {
      where.amenities = { hasEvery: params.amenities };
    }

    return where;
  };

  const listRooms = async (
    params: RoomListParams,
  ): Promise<{ rooms: RoomWithAvailability[]; total: number }> => {
    const where = buildWhere(params);
    const orderBy: Prisma.RoomOrderByWithRelationInput = {
      [params.sortBy]: params.sortOrder,
    };

    const [rows, total] = await Promise.all([
      prisma.room.findMany({
        include: roomInclude,
        orderBy,
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        where,
      }),
      prisma.room.count({ where }),
    ]);

    const { end, start } = resolveDateWindow(params.startDate, params.endDate);
    const rooms = await Promise.all(
      rows.map(async (room) => ({
        availability: await getAvailableRoomsCount(room.id, start, end),
        room,
      })),
    );

    return { rooms, total };
  };

  /**
   * Availability report for an explicit window (both dates required). The
   * counts are computed before the room lookup, so — as in the legacy
   * handler — a missing room 404s only after the date checks pass.
   */
  const checkAvailability = async (
    roomId: number,
    window: DateWindowInput,
  ): Promise<RoomAvailabilityReport> => {
    if (!window.startDate || !window.endDate) {
      throw new BadRequestError('Start date and end date are required');
    }

    const start = new Date(window.startDate);
    const end = new Date(window.endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestError('Invalid date format');
    }

    if (start >= end) {
      throw new BadRequestError('End date must be after start date');
    }

    const { availableRooms, bookedRooms } = await getAvailableRoomsCount(
      roomId,
      start,
      end,
    );

    const room = await prisma.room.findUnique({
      select: { roomType: true, totalRooms: true },
      where: { id: roomId },
    });
    if (!room) throw new NotFoundError('Room not found');

    return {
      availableRooms,
      bookedRooms,
      endDate: end,
      isAvailable: availableRooms > 0,
      roomId,
      roomType: room.roomType,
      startDate: start,
      totalRooms: room.totalRooms,
    };
  };

  /**
   * Deletes one room after the legacy guard chain, in order: completed
   * payments, active bookings, future bookings, ongoing stays, pending
   * payments, and the hotel's last room. Historical (COMPLETED/CANCELLED)
   * bookings never block, they are only counted for the response.
   */
  const deleteRoom = async (id: number): Promise<RoomDeleteSummary> => {
    const room = await prisma.room.findUnique({
      include: {
        bookings: {
          include: {
            payment: { select: { amount: true, id: true, status: true } },
          },
        },
        hotel: { select: { id: true, name: true } },
      },
      where: { id },
    });
    if (!room) throw new NotFoundError('Room not found');

    const bookingsWithCompletedPayment = room.bookings.filter(
      (booking) =>
        booking.payment?.status === PaymentStatus.COMPLETED,
    );
    if (bookingsWithCompletedPayment.length > 0) {
      throw new BadRequestError(
        `Cannot delete room with ${bookingsWithCompletedPayment.length} completed payment(s). Rooms with payment history cannot be deleted for financial and legal compliance.`,
      );
    }

    const activeBookings = room.bookings.filter(
      (booking) =>
        booking.status === BookingStatus.PENDING ||
        booking.status === BookingStatus.CONFIRMED,
    );
    if (activeBookings.length > 0) {
      throw new BadRequestError(
        `Cannot delete room with ${activeBookings.length} active booking(s). Please cancel or complete all bookings first.`,
      );
    }

    const now = clock.now();
    const futureBookings = room.bookings.filter(
      (booking) => booking.startDate && new Date(booking.startDate) > now,
    );
    if (futureBookings.length > 0) {
      throw new BadRequestError(
        `Cannot delete room with ${futureBookings.length} future booking(s). Please handle all future reservations first.`,
      );
    }

    // Ongoing bookings: guests currently checked in.
    const ongoingBookings = room.bookings.filter((booking) => {
      if (!booking.startDate || !booking.endDate) return false;
      const checkIn = new Date(booking.startDate);
      const checkOut = new Date(booking.endDate);
      return (
        checkIn <= now &&
        checkOut >= now &&
        booking.status === BookingStatus.CONFIRMED
      );
    });
    if (ongoingBookings.length > 0) {
      throw new BadRequestError(
        `Cannot delete room with ${ongoingBookings.length} ongoing booking(s). Guests are currently checked in.`,
      );
    }

    const pendingPayments = room.bookings.filter(
      (booking) =>
        booking.payment?.status === PaymentStatus.PENDING,
    );
    if (pendingPayments.length > 0) {
      throw new BadRequestError(
        `Cannot delete room with ${pendingPayments.length} pending payment(s). Please resolve all payments first.`,
      );
    }

    // A hotel must keep at least one room.
    const hotelRoomsCount = await prisma.room.count({
      where: { hotelId: room.hotelId },
    });
    if (hotelRoomsCount <= 1) {
      logger.warn(
        `Deleting the last room (ID: ${id}) for hotel "${room.hotel.name}" (ID: ${room.hotelId}). Hotel will have no available rooms.`,
      );
      throw new BadRequestError(
        `Cannot delete the last room of hotel "${room.hotel.name}". A hotel must have at least one room.`,
      );
    } else if (hotelRoomsCount <= 3) {
      logger.warn(
        `Deleting room (ID: ${id}) - only ${hotelRoomsCount - 1} room(s) will remain for hotel "${room.hotel.name}"`,
      );
    }

    // Historical bookings survive the delete for record-keeping.
    const completedBookings = room.bookings.filter(
      (booking) =>
        booking.status === BookingStatus.COMPLETED ||
        booking.status === BookingStatus.CANCELLED,
    );
    if (completedBookings.length > 0) {
      logger.info(
        `Deleting room (ID: ${id}) with ${completedBookings.length} historical booking(s). These bookings will remain for record-keeping.`,
      );
    }

    await prisma.room.delete({ where: { id } });

    if (room.photo) {
      await cleanupPhoto(
        room.photo,
        'Failed to clean up room photo from Cloudinary',
      );
    }

    logger.info(
      `Room deleted successfully - ID: ${id}, Type: ${room.roomType}, Hotel: ${room.hotel.name} (ID: ${room.hotelId})`,
    );

    return {
      deletedAt: clock.now().toISOString(),
      historicalBookingsCount: completedBookings.length,
      hotelName: room.hotel.name,
      id: room.id,
      roomType: room.roomType,
    };
  };

  /**
   * Bulk-deletes every room without blocking conditions (same per-room guard
   * list as deleteRoom, minus the last-room rule, which is enforced here as
   * "no hotel may end up with zero rooms"). Refuses outright when nothing is
   * deletable or when a hotel would lose all of its rooms.
   */
  const deleteAllRooms = async (): Promise<RoomBulkDeleteSummary> => {
    const now = clock.now();

    const rooms = await prisma.room.findMany({
      include: {
        bookings: {
          include: { payment: { select: { id: true, status: true } } },
        },
        hotel: { select: { id: true, name: true } },
      },
    });

    if (rooms.length === 0) {
      throw new NotFoundError('No rooms found to delete');
    }

    // Categorize rooms and identify blocking conditions.
    const deletableRooms: typeof rooms = [];
    const roomsWithIssues: {
      reasons: string[];
      room: (typeof rooms)[0];
    }[] = [];

    for (const room of rooms) {
      const issues: string[] = [];

      const hasCompletedPayment = room.bookings.some(
        (booking) =>
          booking.payment?.status === PaymentStatus.COMPLETED,
      );
      if (hasCompletedPayment) {
        issues.push('has completed payment(s)');
      }

      const hasActiveBooking = room.bookings.some(
        (booking) =>
          booking.status === BookingStatus.PENDING ||
          booking.status === BookingStatus.CONFIRMED,
      );
      if (hasActiveBooking) {
        issues.push('has active booking(s)');
      }

      const hasFutureBooking = room.bookings.some(
        (booking) => booking.startDate && new Date(booking.startDate) > now,
      );
      if (hasFutureBooking) {
        issues.push('has future booking(s)');
      }

      const hasOngoingBooking = room.bookings.some((booking) => {
        if (!booking.startDate || !booking.endDate) return false;
        const checkIn = new Date(booking.startDate);
        const checkOut = new Date(booking.endDate);
        return (
          checkIn <= now &&
          checkOut >= now &&
          booking.status === BookingStatus.CONFIRMED
        );
      });
      if (hasOngoingBooking) {
        issues.push('has ongoing booking(s) - guests currently checked in');
      }

      const hasPendingPayment = room.bookings.some(
        (booking) =>
          booking.payment?.status === PaymentStatus.PENDING,
      );
      if (hasPendingPayment) {
        issues.push('has pending payment(s)');
      }

      if (issues.length === 0) {
        deletableRooms.push(room);
      } else {
        roomsWithIssues.push({ reasons: issues, room });
      }
    }

    if (deletableRooms.length === 0) {
      const issuesSummary = roomsWithIssues
        .slice(0, 5)
        .map(
          ({ reasons, room }) =>
            `Room ${room.id} (${room.roomType} at ${room.hotel.name}): ${reasons.join(', ')}`,
        )
        .join('; ');

      throw new BadRequestError(
        `Cannot delete any rooms. All ${rooms.length} room(s) have blocking conditions: ${issuesSummary}${roomsWithIssues.length > 5 ? '...' : ''}`,
      );
    }

    const hotelRoomCounts = new Map<number, number>();
    for (const room of rooms) {
      hotelRoomCounts.set(
        room.hotelId,
        (hotelRoomCounts.get(room.hotelId) ?? 0) + 1,
      );
    }

    const hotelsLosingAllRooms: string[] = [];
    for (const room of deletableRooms) {
      const currentCount = hotelRoomCounts.get(room.hotelId) ?? 0;
      const deletableForHotel = deletableRooms.filter(
        (r) => r.hotelId === room.hotelId,
      ).length;

      if (
        currentCount === deletableForHotel &&
        !hotelsLosingAllRooms.includes(room.hotel.name)
      ) {
        hotelsLosingAllRooms.push(room.hotel.name);
      }
    }

    if (hotelsLosingAllRooms.length > 0) {
      logger.warn(
        `The following hotel(s) will have NO rooms after this operation: ${hotelsLosingAllRooms.join(', ')}`,
      );
      throw new BadRequestError(
        `Cannot proceed: Hotels [${hotelsLosingAllRooms.join(', ')}] would have no rooms remaining.`,
      );
    }

    await prisma.room.deleteMany({
      where: { id: { in: deletableRooms.map((r) => r.id) } },
    });

    await Promise.allSettled(
      deletableRooms.flatMap((room) =>
        room.photo
          ? [cleanupPhoto(room.photo, `Failed to clean up photo ${room.photo}:`)]
          : [],
      ),
    );

    logger.info(
      `Bulk room deletion completed - Deleted: ${deletableRooms.length}, Skipped: ${roomsWithIssues.length}`,
    );

    // The legacy response also spread a `warning` key for hotels losing all
    // rooms, but that branch is unreachable (it throws above), so it was
    // dropped here.
    return {
      deleted: deletableRooms.length,
      hotelsAffected: new Set(deletableRooms.map((r) => r.hotel.name)).size,
      skipped: roomsWithIssues.length,
      total: rooms.length,
      ...(roomsWithIssues.length > 0 && {
        skippedDetails: roomsWithIssues.slice(0, 10).map(({ reasons, room }) => ({
          hotel: room.hotel.name,
          reasons,
          roomId: room.id,
          roomType: room.roomType,
        })),
      }),
    };
  };

  return {
    checkAvailability,
    createRoom,
    deleteAllRooms,
    deleteRoom,
    getRoomById,
    listRooms,
    updateRoom,
  };
};

export const roomService = makeRoomService(defaultDeps);

export const {
  checkAvailability,
  createRoom,
  deleteAllRooms,
  deleteRoom,
  getRoomById,
  listRooms,
  updateRoom,
} = roomService;
