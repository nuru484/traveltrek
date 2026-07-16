// src/utils/mappers/room.mapper.ts
//
// Pure DTO mappers for the room domain. Services return Prisma rows (with
// `roomInclude` relations) plus the availability counts computed for the
// requested date window; controllers map both through here so the wire format
// lives in exactly one place and raw DB records never leak.
import type { Prisma } from '../../config/prismaClient';

/** Hotel fields exposed on room responses. */
export const roomHotelSelect = {
  description: true,
  id: true,
  name: true,
} satisfies Prisma.HotelSelect;

/** Relations every room read/mutation fetches; services pass this to Prisma. */
export const roomInclude = {
  hotel: { select: roomHotelSelect },
} satisfies Prisma.RoomInclude;

/** Booked-vs-free counts for one room over a date window. */
export interface RoomAvailabilityCounts {
  availableRooms: number;
  bookedRooms: number;
}

export interface RoomDTO {
  amenities: string[];
  capacity: number;
  createdAt: Date;
  description: null | string;
  hotel: RoomHotelSummary;
  id: number;
  photo: null | string;
  pricePerNight: number;
  roomsAvailable: number;
  roomsBooked: number;
  roomType: string;
  totalRooms: number;
  updatedAt: Date;
}

export type RoomHotelSummary = Prisma.HotelGetPayload<{
  select: typeof roomHotelSelect;
}>;

export type RoomWithRelations = Prisma.RoomGetPayload<{
  include: typeof roomInclude;
}>;

export const toRoomDTO = (
  room: RoomWithRelations,
  availability: RoomAvailabilityCounts,
): RoomDTO => ({
  amenities: room.amenities,
  capacity: room.capacity,
  createdAt: room.createdAt,
  description: room.description,
  hotel: room.hotel,
  id: room.id,
  photo: room.photo,
  pricePerNight: room.pricePerNight,
  roomsAvailable: availability.availableRooms,
  roomsBooked: availability.bookedRooms,
  roomType: room.roomType,
  totalRooms: room.totalRooms,
  updatedAt: room.updatedAt,
});
