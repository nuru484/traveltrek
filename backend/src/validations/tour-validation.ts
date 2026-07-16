// src/validations/tour-validation.ts
//
// Zod schemas for the tour domain (replaces the express-validator chains).
// Boundary rules only — shape, ranges, enums and date ordering. Invariants
// that need the database (destination existence, booking guards, status
// transitions) live in services/tour.service.ts.
import { z } from 'zod';

import { TourStatus, TourType } from '#config/prismaClient.js';
import { TOUR_SORT_FIELDS } from '#services/tour.service.js';
import { boolQuery, paginationQuery } from '#validations/common-validation.js';

const tourFields = z.object({
  description: z
    .string()
    .trim()
    .max(5000, 'Description must not exceed 5000 characters')
    .optional(),
  // Multipart form fields (photo uploads) arrive as strings, so numbers are
  // coerced — same as the hotel/flight schemas.
  destinationId: z.coerce.number().int().min(1),
  endDate: z.coerce.date('endDate must be a valid date'),
  maxGuests: z.coerce.number().int().min(1).max(1000),
  name: z
    .string('Tour name must be between 3 and 200 characters')
    .trim()
    .min(3, 'Tour name must be between 3 and 200 characters')
    .max(200, 'Tour name must be between 3 and 200 characters'),
  // Integer minor units (pesewas): GH₵ 1.00 = 100. Max 10,000,000 GHS.
  price: z.coerce.number().int().min(0).max(1_000_000_000),
  startDate: z.coerce.date('startDate must be a valid date'),
  // Either a client-sent URL or, after the Cloudinary middleware runs, the
  // uploaded image URL. A multipart file upload arrives as req.file instead
  // and is guarded by the controller's photo-file middleware.
  tourPhoto: z.string().optional(),
  type: z.enum(TourType),
});

export const createTourSchema = tourFields
  .refine((body) => body.startDate.getTime() >= Date.now(), {
    error: 'Start date must be in the future',
    path: ['startDate'],
  })
  .refine((body) => body.endDate > body.startDate, {
    error: 'End date must be after start date',
    path: ['endDate'],
  });

// Date rules involving the stored tour (future-dating an edit, ordering
// against the unchanged date) are enforced by the update service, which knows
// the existing row. Here we only check ordering when both dates are sent.
export const updateTourSchema = tourFields
  .partial()
  .refine(
    (body) => !body.startDate || !body.endDate || body.endDate > body.startDate,
    { error: 'End date must be after start date', path: ['endDate'] },
  );

export const tourStatusSchema = z.object({
  status: z.enum(TourStatus, 'Invalid tour status'),
});

export const tourListQuery = paginationQuery
  .extend({
    availableOnly: boolQuery.optional(),
    city: z.string().trim().min(1).max(255).optional(),
    country: z.string().trim().min(1).max(255).optional(),
    destinationId: z.coerce.number().int().min(1).optional(),
    endDate: z.coerce.date().optional(),
    maxDuration: z.coerce.number().int().min(1).optional(),
    maxGuests: z.coerce.number().int().min(1).max(1000).optional(),
    // Price bounds are integer minor units (pesewas), like the price column.
    maxPrice: z.coerce.number().int().min(0).optional(),
    minDuration: z.coerce.number().int().min(1).optional(),
    minGuests: z.coerce.number().int().min(1).optional(),
    minPrice: z.coerce.number().int().min(0).optional(),
    search: z
      .string()
      .trim()
      .min(1, 'Search term must be between 1 and 200 characters')
      .max(200, 'Search term must be between 1 and 200 characters')
      .optional(),
    sortBy: z.enum(TOUR_SORT_FIELDS).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
    startDate: z.coerce.date().optional(),
    status: z.enum(TourStatus).optional(),
    type: z.enum(TourType).optional(),
  })
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
      q.minDuration === undefined ||
      q.maxDuration === undefined ||
      q.maxDuration >= q.minDuration,
    {
      error:
        'Maximum duration must be greater than or equal to minimum duration',
      path: ['maxDuration'],
    },
  )
  .refine(
    (q) =>
      q.minGuests === undefined ||
      q.maxGuests === undefined ||
      q.maxGuests >= q.minGuests,
    {
      error: 'Maximum guests must be greater than or equal to minimum guests',
      path: ['maxGuests'],
    },
  );

export type CreateTourBody = z.infer<typeof createTourSchema>;
export type TourListQuery = z.infer<typeof tourListQuery>;
export type TourStatusBody = z.infer<typeof tourStatusSchema>;
export type UpdateTourBody = z.infer<typeof updateTourSchema>;
