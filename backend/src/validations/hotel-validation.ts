// src/validations/hotel-validation.ts
//
// Zod schemas for the hotel domain (replaces the express-validator chains).
// Boundary rules only — shape, lengths, ranges and character patterns.
// Invariants that need the database (destination existence, delete-with-rooms
// guards) and the multer file checks (zod only sees req.body) live in
// services/hotel.service.ts and the controller's photo-file middleware.
import { z } from 'zod';

import { HOTEL_SORT_FIELDS } from '#services/hotel.service.js';
import { paginationQuery } from '#validations/common-validation.js';

/** Letters, spaces, hyphens and apostrophes — the legacy place-name pattern. */
const PLACE_NAME_PATTERN = /^[a-zA-Z\s\-']+$/;

/** Optional +, then 10–15 digits — the legacy phone pattern. */
const PHONE_PATTERN = /^\+?[0-9]{10,15}$/;

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

const hotelFields = z.object({
  address: z
    .string('Address must be between 5 and 255 characters')
    .trim()
    .min(5, 'Address must be between 5 and 255 characters')
    .max(255, 'Address must be between 5 and 255 characters'),
  amenities: amenitiesList.optional(),
  description: z
    .string()
    .trim()
    .max(2000, 'Description must not exceed 2000 characters')
    .optional(),
  // Multipart form fields arrive as strings, so numbers are coerced.
  destinationId: z.coerce
    .number('A valid destinationId is required')
    .int('A valid destinationId is required')
    .min(1, 'A valid destinationId is required'),
  // Either a client-sent URL or, after the Cloudinary middleware runs, the
  // uploaded image URL. A multipart file upload arrives as req.file instead
  // and is guarded by the controller's photo-file middleware.
  hotelPhoto: z.string().optional(),
  name: z
    .string('Hotel name must be between 2 and 100 characters')
    .trim()
    .min(2, 'Hotel name must be between 2 and 100 characters')
    .max(100, 'Hotel name must be between 2 and 100 characters'),
  phone: z
    .string()
    .trim()
    .regex(PHONE_PATTERN, 'Must be a valid phone number (10–15 digits)')
    .optional(),
  starRating: z.coerce
    .number('Star rating must be an integer between 1 and 5')
    .int('Star rating must be an integer between 1 and 5')
    .min(1, 'Star rating must be an integer between 1 and 5')
    .max(5, 'Star rating must be an integer between 1 and 5')
    .optional(),
});

export const createHotelSchema = hotelFields;

// Empty updates were accepted by the legacy handler (a no-op update returning
// the hotel), so no "at least one field" refinement here.
export const updateHotelSchema = hotelFields.partial();

export const hotelListQuery = paginationQuery
  .extend({
    // A single ?amenities=x arrives as a string, repeated params as an array.
    amenities: z
      .union([z.string(), z.array(z.string())], 'amenities must be a list')
      .transform((value) => (Array.isArray(value) ? value : [value]))
      .pipe(amenityItem.array().max(10, 'amenities must contain at most 10 items'))
      .optional(),
    city: z
      .string()
      .trim()
      .min(1, 'City filter must contain only letters, spaces, hyphens, and apostrophes')
      .max(100, 'City filter must contain only letters, spaces, hyphens, and apostrophes')
      .regex(
        PLACE_NAME_PATTERN,
        'City filter must contain only letters, spaces, hyphens, and apostrophes',
      )
      .optional(),
    country: z
      .string()
      .trim()
      .min(2, 'Country filter must contain only letters, spaces, hyphens, and apostrophes')
      .max(100, 'Country filter must contain only letters, spaces, hyphens, and apostrophes')
      .regex(
        PLACE_NAME_PATTERN,
        'Country filter must contain only letters, spaces, hyphens, and apostrophes',
      )
      .optional(),
    destinationId: z.coerce.number().int().min(1).optional(),
    maxStarRating: z.coerce.number().int().min(1).max(5).optional(),
    minStarRating: z.coerce.number().int().min(1).max(5).optional(),
    search: z
      .string()
      .trim()
      .min(1, 'Search term must be between 1 and 100 characters')
      .max(100, 'Search term must be between 1 and 100 characters')
      .optional(),
    sortBy: z.enum(HOTEL_SORT_FIELDS).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
    starRating: z.coerce.number().int().min(1).max(5).optional(),
  })
  .refine(
    (q) =>
      q.minStarRating === undefined ||
      q.maxStarRating === undefined ||
      q.maxStarRating >= q.minStarRating,
    {
      error:
        'Maximum star rating must be greater than or equal to minimum star rating',
      path: ['maxStarRating'],
    },
  );

export type CreateHotelBody = z.infer<typeof createHotelSchema>;
export type HotelListQuery = z.infer<typeof hotelListQuery>;
export type UpdateHotelBody = z.infer<typeof updateHotelSchema>;
