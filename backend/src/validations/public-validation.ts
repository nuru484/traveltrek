// src/validations/public-validation.ts
//
// Zod schemas for the unauthenticated /public browse surface. Deliberately
// smaller than the authed listing filters: pagination plus a modest search /
// type / destination narrowing — the landing page needs nothing more, and a
// small surface is a small abuse target.
import { z } from 'zod';

import { TourType } from '#config/prismaClient.js';
import { paginationQuery } from '#validations/common-validation.js';

const searchField = z
  .string()
  .trim()
  .min(1, 'Search term must be between 1 and 100 characters')
  .max(100, 'Search term must be between 1 and 100 characters')
  .optional();

export const publicListQuery = paginationQuery;

export const publicTourListQuery = paginationQuery.extend({
  destinationId: z.coerce.number().int().min(1).optional(),
  search: searchField,
  type: z.enum(TourType).optional(),
});

export const publicHotelListQuery = paginationQuery.extend({
  destinationId: z.coerce.number().int().min(1).optional(),
  search: searchField,
});

export const publicFlightListQuery = paginationQuery.extend({
  destinationId: z.coerce.number().int().min(1).optional(),
  originId: z.coerce.number().int().min(1).optional(),
  search: searchField,
});

/** The landing testimonial strip: latest N published reviews. */
export const recentReviewsQuery = z.object({
  limit: z.coerce.number().int().positive().max(50).default(6),
});

export type PublicFlightListQuery = z.infer<typeof publicFlightListQuery>;
export type PublicHotelListQuery = z.infer<typeof publicHotelListQuery>;
export type PublicListQuery = z.infer<typeof publicListQuery>;
export type PublicTourListQuery = z.infer<typeof publicTourListQuery>;
export type RecentReviewsQuery = z.infer<typeof recentReviewsQuery>;
