// src/services/room/shared.ts
//
// Dependency-free building blocks for the rooms domain: the sort-field
// whitelist and the request/result types. Shared by the room core and every
// feature module.
import { type AppDeps } from '#services/deps.js';
import {
  type RoomAvailabilityCounts,
  type RoomWithRelations,
} from '#utils/mappers/room.mapper.js';

/** The deps the rooms domain draws from the app container. */
export type RoomDeps = Pick<
  AppDeps,
  'clock' | 'cloudinary' | 'logger' | 'prisma'
>;

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
