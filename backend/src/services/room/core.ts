// src/services/room/core.ts
//
// The shared rooms engine: best-effort photo cleanup, the availability-window
// resolution and the booked/available counting math, the default-window
// availability, and the list where-clause builder. Built once per deps.
import { BookingStatus, type Prisma } from '#config/prismaClient.js';
import { BadRequestError } from '#middlewares/error-handler.js';
import {
  type RoomDeps,
  type RoomListParams,
} from '#services/room/shared.js';
import { type RoomAvailabilityCounts } from '#utils/mappers/room.mapper.js';

export type RoomCore = ReturnType<typeof makeRoomCore>;

export const makeRoomCore = (d: RoomDeps) => {
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
   * Resolves the availability window: defaults to [now, now + 1 day], and
   * only when BOTH dates are sent are they parsed and checked (falsy/empty
   * params fall back to the default).
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

  /** Booked/available counts for a date range. */
  const getAvailableRoomsCount = async (
    roomId: number,
    startDate: Date,
    endDate: Date,
  ): Promise<RoomAvailabilityCounts> => {
    // findFirst so a soft-deleted room reports {0, 0} like a missing one.
    const room = await prisma.room.findFirst({
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

  return {
    buildWhere,
    cleanupPhoto,
    getAvailableRoomsCount,
    getCurrentAvailability,
    resolveDateWindow,
  };
};
