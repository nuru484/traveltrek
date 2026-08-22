// src/services/room/query.service.ts
//
// Room read paths: fetch one with counts for the requested window, the
// filtered/sorted listing (each row carries its window availability), and the
// explicit-window availability report. All availability math runs through the
// room core.
import { type Prisma } from '#config/prismaClient.js';
import {
  BadRequestError,
  NotFoundError,
} from '#middlewares/error-handler.js';
import { type RoomCore } from '#services/room/core.js';
import {
  type DateWindowInput,
  type RoomAvailabilityReport,
  type RoomDeps,
  type RoomListParams,
  type RoomWithAvailability,
} from '#services/room/shared.js';
import { roomInclude } from '#utils/mappers/room.mapper.js';

export const makeRoomQueryService = (d: RoomDeps, core: RoomCore) => {
  const { prisma } = d;
  const { buildWhere, getAvailableRoomsCount, resolveDateWindow } = core;

  /**
   * Fetches a room with counts for the requested window. The 404 fires before
   * the date checks.
   */
  const getRoomById = async (
    id: number,
    window: DateWindowInput = {},
  ): Promise<RoomWithAvailability> => {
    const room = await prisma.room.findFirst({
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
   * counts are computed before the room lookup, so a missing room 404s only
   * after the date checks pass.
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

    const room = await prisma.room.findFirst({
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

  return { checkAvailability, getRoomById, listRooms };
};
