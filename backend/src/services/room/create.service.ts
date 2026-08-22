// src/services/room/create.service.ts
//
// Room creation: hotel existence + duplicate room-type guard, then the insert,
// returning the row with its current-window availability. A refused create
// reclaims the already-uploaded photo.
import { HTTP_STATUS_CODES } from '#config/constants.js';
import {
  CustomError,
  NotFoundError,
} from '#middlewares/error-handler.js';
import { type RoomCore } from '#services/room/core.js';
import {
  type RoomDeps,
  type RoomInput,
  type RoomWithAvailability,
} from '#services/room/shared.js';
import { roomInclude } from '#utils/mappers/room.mapper.js';

export const makeRoomCreateService = (d: RoomDeps, core: RoomCore) => {
  const { prisma } = d;
  const { cleanupPhoto, getCurrentAvailability } = core;

  const createRoom = async (
    input: RoomInput,
  ): Promise<RoomWithAvailability> => {
    try {
      const hotel = await prisma.hotel.findFirst({
        select: { id: true },
        where: { id: input.hotelId },
      });
      if (!hotel) throw new NotFoundError('Hotel not found');

      // Auto-scoped: a soft-deleted room's type may be reused for a new room.
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
      // it on Cloudinary when the create is refused.
      if (input.photo) {
        await cleanupPhoto(input.photo, 'Failed to clean up Cloudinary image');
      }
      throw error;
    }
  };

  return { createRoom };
};
