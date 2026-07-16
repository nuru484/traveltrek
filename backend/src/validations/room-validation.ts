// src/validations/room-validation.ts
//
// Zod schemas for the room domain (the legacy controller validated nothing at
// the boundary — inputs went straight through Number()/trim()). Boundary
// rules only — shape, lengths and ranges. Invariants that need the database
// (hotel existence, duplicate room types, booking-aware guards) and the
// availability date-window rules (both dates or neither; "Invalid date
// format"; end after start — kept in the service so the legacy messages and
// error order survive) live in services/room.service.ts; the multer file
// checks (zod only sees req.body) live in the controller's photo-file
// middleware.
import { z } from 'zod';

import { ROOM_SORT_FIELDS } from '#services/room.service.js';
import { paginationQuery } from '#validations/common-validation.js';

const amenityItem = z
  .string('Each amenity must be a non-empty string with maximum 50 characters')
  .trim()
  .min(1, 'Each amenity must be a non-empty string with maximum 50 characters')
  .max(
    50,
    'Each amenity must be a non-empty string with maximum 50 characters',
  );

const amenitiesList = z
  .array(amenityItem, 'amenities must be an array')
  .max(20, 'amenities must contain at most 20 items')
  .refine((items) => new Set(items).size === items.length, {
    error: 'amenities must contain unique items',
  });

/**
 * Optional start/end availability params, passed through as raw strings: the
 * service resolves them with the legacy rules (defaults apply unless BOTH are
 * sent; empty strings count as absent, as before).
 */
export const roomAvailabilityQuery = z.object({
  endDate: z.string().optional(),
  startDate: z.string().optional(),
});

const roomFields = z.object({
  amenities: amenitiesList.optional(),
  // Multipart form fields arrive as strings, so numbers are coerced.
  capacity: z.coerce
    .number('Capacity must be a positive integer')
    .int('Capacity must be a positive integer')
    .min(1, 'Capacity must be a positive integer'),
  description: z
    .string()
    .trim()
    .max(2000, 'Description must not exceed 2000 characters')
    .optional(),
  hotelId: z.coerce
    .number('A valid hotelId is required')
    .int('A valid hotelId is required')
    .min(1, 'A valid hotelId is required'),
  // Integer minor units (pesewas): GH₵ 1.00 = 100.
  pricePerNight: z.coerce
    .number('Price per night must be a positive integer (pesewas)')
    .int('Price per night must be a positive integer (pesewas)')
    .positive('Price per night must be a positive integer (pesewas)'),
  // Either a client-sent URL or, after the Cloudinary middleware runs, the
  // uploaded image URL. A multipart file upload arrives as req.file instead
  // and is guarded by the controller's photo-file middleware.
  roomPhoto: z.string().optional(),
  roomType: z
    .string('Room type must be between 1 and 100 characters')
    .trim()
    .min(1, 'Room type must be between 1 and 100 characters')
    .max(100, 'Room type must be between 1 and 100 characters'),
  totalRooms: z.coerce
    .number('Total rooms must be a positive integer')
    .int('Total rooms must be a positive integer')
    .min(1, 'Total rooms must be a positive integer'),
});

export const createRoomSchema = roomFields;

// Empty updates were accepted by the legacy handler (a no-op update returning
// the room), so no "at least one field" refinement here. roomPhoto: '' is
// the remove-photo signal (the service nulls the column and deletes the old
// Cloudinary image).
export const updateRoomSchema = roomFields.partial();

export const roomListQuery = paginationQuery
  .extend({
    // A single ?amenities=x arrives as a string, repeated params as an array.
    amenities: z
      .union([z.string(), z.array(z.string())], 'amenities must be a list')
      .transform((value) => (Array.isArray(value) ? value : [value]))
      .pipe(
        amenityItem.array().max(10, 'amenities must contain at most 10 items'),
      )
      .optional(),
    hotelId: z.coerce.number().int().min(1).optional(),
    maxCapacity: z.coerce.number().int().min(1).optional(),
    // Price bounds are integer minor units (pesewas), like pricePerNight.
    maxPrice: z.coerce.number().int().min(0).optional(),
    minCapacity: z.coerce.number().int().min(1).optional(),
    minPrice: z.coerce.number().int().min(0).optional(),
    roomType: z
      .string()
      .trim()
      .min(1, 'Room type filter must be between 1 and 100 characters')
      .max(100, 'Room type filter must be between 1 and 100 characters')
      .optional(),
    sortBy: z.enum(ROOM_SORT_FIELDS).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  })
  .extend(roomAvailabilityQuery.shape)
  .refine(
    (q) =>
      q.minPrice === undefined ||
      q.maxPrice === undefined ||
      q.maxPrice >= q.minPrice,
    {
      error: 'Maximum price must be greater than or equal to minimum price',
      path: ['maxPrice'],
    },
  )
  .refine(
    (q) =>
      q.minCapacity === undefined ||
      q.maxCapacity === undefined ||
      q.maxCapacity >= q.minCapacity,
    {
      error:
        'Maximum capacity must be greater than or equal to minimum capacity',
      path: ['maxCapacity'],
    },
  );

export type CreateRoomBody = z.infer<typeof createRoomSchema>;
export type RoomAvailabilityQuery = z.infer<typeof roomAvailabilityQuery>;
export type RoomListQuery = z.infer<typeof roomListQuery>;
export type UpdateRoomBody = z.infer<typeof updateRoomSchema>;
