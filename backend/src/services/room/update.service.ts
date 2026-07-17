// src/services/room/update.service.ts
//
// Room update: the booking-aware guards (hotel/room-type change, capacity and
// total-rooms floors against active bookings, duplicate room-type), the write,
// and the photo replace/remove cleanup. Availability recomputed for the
// default window on return.
import { HTTP_STATUS_CODES } from '#config/constants.js';
import { BookingStatus, type Prisma } from '#config/prismaClient.js';
import {
  BadRequestError,
  CustomError,
  NotFoundError,
} from '#middlewares/error-handler.js';
import { type RoomCore } from '#services/room/core.js';
import {
  type RoomDeps,
  type RoomUpdateInput,
  type RoomWithAvailability,
} from '#services/room/shared.js';
import { roomInclude } from '#utils/mappers/room.mapper.js';
import { photoColumnValue } from '#utils/photo-removal.js';

export const makeRoomUpdateService = (d: RoomDeps, core: RoomCore) => {
  const { logger, prisma } = d;
  const { cleanupPhoto, getCurrentAvailability } = core;

  const updateRoom = async (
    id: number,
    input: RoomUpdateInput,
  ): Promise<RoomWithAvailability> => {
    const uploadedPhotoUrl = input.photo;

    try {
      const existingRoom = await prisma.room.findFirst({
        include: {
          bookings: {
            select: { id: true, numberOfRooms: true, status: true },
            // Nested reads are not auto-scoped; skip soft-deleted bookings.
            where: {
              deletedAt: null,
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

      if (
        input.hotelId !== undefined &&
        input.hotelId !== existingRoom.hotelId
      ) {
        if (hasActiveBookings) {
          throw new BadRequestError(
            'Cannot change hotel when active bookings exist. Please cancel all bookings first or create a new room.',
          );
        }

        const hotel = await prisma.hotel.findFirst({
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

      if (
        input.totalRooms !== undefined &&
        input.totalRooms < totalBookedRooms
      ) {
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
        photo: photoColumnValue(uploadedPhotoUrl),
        pricePerNight: input.pricePerNight,
        roomType: input.roomType?.trim(),
        totalRooms: input.totalRooms,
      };

      const updatedRoom = await prisma.room.update({
        data,
        include: roomInclude,
        where: { id },
      });

      // Replaced or removed photo: drop the old image now that the row no
      // longer points at it ('' — the removal signal — is covered too).
      if (
        uploadedPhotoUrl !== undefined &&
        oldPhoto &&
        oldPhoto !== uploadedPhotoUrl
      ) {
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

  return { updateRoom };
};
