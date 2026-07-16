// src/validations/destination-validation.ts
//
// Zod schemas for the destination domain (replaces the express-validator
// chains). Boundary rules only — shape, lengths and character patterns.
// Invariants that need the database (name uniqueness, dependency guards) and
// the multer file checks (zod only sees req.body) live in
// services/destination.service.ts and the controller's photo-file middleware.
import { z } from 'zod';

import { DESTINATION_SORT_FIELDS } from '../services/destination.service';
import { paginationQuery } from './common-validation';

/** Letters, spaces, hyphens and apostrophes — the legacy place-name pattern. */
const PLACE_NAME_PATTERN = /^[a-zA-Z\s\-']+$/;

const destinationFields = z.object({
  city: z
    .string()
    .trim()
    .max(100, 'City must not exceed 100 characters')
    .regex(
      PLACE_NAME_PATTERN,
      'City must contain only letters, spaces, hyphens, and apostrophes',
    )
    .optional(),
  country: z
    .string('Country must be between 2 and 100 characters')
    .trim()
    .min(2, 'Country must be between 2 and 100 characters')
    .max(100, 'Country must be between 2 and 100 characters')
    .regex(
      PLACE_NAME_PATTERN,
      'Country must contain only letters, spaces, hyphens, and apostrophes',
    ),
  description: z
    .string()
    .trim()
    .max(1000, 'Description must not exceed 1000 characters')
    .optional(),
  // Either a client-sent URL or, after the Cloudinary middleware runs, the
  // uploaded image URL. A multipart file upload arrives as req.file instead
  // and is guarded by the controller's photo-file middleware.
  destinationPhoto: z.string().optional(),
  name: z
    .string('Destination name must be between 2 and 100 characters')
    .trim()
    .min(2, 'Destination name must be between 2 and 100 characters')
    .max(100, 'Destination name must be between 2 and 100 characters'),
});

export const createDestinationSchema = destinationFields;

// "At least one field provided" is enforced by the update service, which also
// sees the multer-uploaded photo that never passes through req.body here.
export const updateDestinationSchema = destinationFields.partial();

export const destinationListQuery = paginationQuery.extend({
  city: z
    .string()
    .trim()
    .min(1, 'City filter must be between 1 and 100 characters')
    .max(100, 'City filter must be between 1 and 100 characters')
    .regex(
      PLACE_NAME_PATTERN,
      'City filter must contain only letters, spaces, hyphens, and apostrophes',
    )
    .optional(),
  country: z
    .string()
    .trim()
    .min(2, 'Country filter must be between 2 and 100 characters')
    .max(100, 'Country filter must be between 2 and 100 characters')
    .regex(
      PLACE_NAME_PATTERN,
      'Country filter must contain only letters, spaces, hyphens, and apostrophes',
    )
    .optional(),
  search: z
    .string()
    .trim()
    .min(1, 'Search term must be between 1 and 100 characters')
    .max(100, 'Search term must be between 1 and 100 characters')
    .optional(),
  sortBy: z.enum(DESTINATION_SORT_FIELDS).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type CreateDestinationBody = z.infer<typeof createDestinationSchema>;
export type DestinationListQuery = z.infer<typeof destinationListQuery>;
export type UpdateDestinationBody = z.infer<typeof updateDestinationSchema>;
