// src/utils/mappers/hotel.mapper.ts
//
// Pure DTO mappers for the hotel domain. Services return Prisma rows (with
// `hotelInclude` relations); controllers map them through here so the wire
// format lives in exactly one place and raw DB records never leak.
import type { Prisma } from '#config/prismaClient.js';
import type { RatingSummary } from '#utils/mappers/review.mapper.js';

/** Destination fields exposed on hotel responses. */
export const hotelDestinationSelect = {
  city: true,
  country: true,
  description: true,
  id: true,
  name: true,
} satisfies Prisma.DestinationSelect;

/** Room fields exposed on hotel responses. */
export const hotelRoomSelect = {
  description: true,
  id: true,
  photo: true,
  pricePerNight: true,
  roomType: true,
} satisfies Prisma.RoomSelect;

/** Relations every hotel read/mutation fetches; services pass this to Prisma. */
export const hotelInclude = {
  destination: { select: hotelDestinationSelect },
  rooms: { select: hotelRoomSelect },
} satisfies Prisma.HotelInclude;

export type HotelDestinationSummary = Prisma.DestinationGetPayload<{
  select: typeof hotelDestinationSelect;
}>;

export interface HotelDTO {
  address: string;
  amenities: string[];
  createdAt: Date;
  description: null | string;
  destination: HotelDestinationSummary;
  id: number;
  name: string;
  phone: null | string;
  photo: null | string;
  /** Aggregate of PUBLISHED reviews of this hotel's rooms. */
  rating: RatingSummary;
  rooms: HotelRoomSummary[];
  starRating: number;
  updatedAt: Date;
}

export type HotelRoomSummary = Prisma.RoomGetPayload<{
  select: typeof hotelRoomSelect;
}>;

export type HotelWithRelations = Prisma.HotelGetPayload<{
  include: typeof hotelInclude;
}>;

export const toHotelDTO = (
  hotel: HotelWithRelations,
  rating: RatingSummary,
): HotelDTO => ({
  address: hotel.address,
  amenities: hotel.amenities,
  createdAt: hotel.createdAt,
  description: hotel.description,
  destination: hotel.destination,
  id: hotel.id,
  name: hotel.name,
  phone: hotel.phone,
  photo: hotel.photo,
  rating,
  rooms: hotel.rooms,
  starRating: hotel.starRating,
  updatedAt: hotel.updatedAt,
});
