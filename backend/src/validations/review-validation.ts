// src/validations/review-validation.ts
//
// Zod schemas for the review domain. Boundary rules only — shape, ranges and
// lengths. Invariants that need the database (own-completed-booking rule, the
// one-review-per-booking 409, the 30-day edit window, moderation) live in
// services/review.service.ts.
import { z } from 'zod';

import { ReviewStatus } from '#config/prismaClient.js';
import { paginationQuery } from '#validations/common-validation.js';

const ratingField = z
  .number('Rating must be an integer between 1 and 5')
  .int('Rating must be an integer between 1 and 5')
  .min(1, 'Rating must be an integer between 1 and 5')
  .max(5, 'Rating must be an integer between 1 and 5');

const reviewTextFields = {
  comment: z
    .string()
    .trim()
    .max(2000, 'Comment must not exceed 2000 characters')
    .optional(),
  title: z
    .string()
    .trim()
    .max(120, 'Title must not exceed 120 characters')
    .optional(),
};

export const createReviewSchema = z.object({
  bookingId: z
    .number('A valid bookingId is required')
    .int('A valid bookingId is required')
    .min(1, 'A valid bookingId is required'),
  rating: ratingField,
  ...reviewTextFields,
});

export const updateReviewSchema = z.object({
  rating: ratingField.optional(),
  ...reviewTextFields,
});

export const reviewStatusSchema = z.object({
  status: z.enum(ReviewStatus, 'Invalid review status'),
});

export const reviewListQuery = paginationQuery.extend({
  rating: z.coerce.number().int().min(1).max(5).optional(),
  search: z
    .string()
    .trim()
    .min(1, 'Search term must be between 1 and 100 characters')
    .max(100, 'Search term must be between 1 and 100 characters')
    .optional(),
  status: z.enum(ReviewStatus).optional(),
});

export type CreateReviewBody = z.infer<typeof createReviewSchema>;
export type ReviewListQuery = z.infer<typeof reviewListQuery>;
export type ReviewStatusBody = z.infer<typeof reviewStatusSchema>;
export type UpdateReviewBody = z.infer<typeof updateReviewSchema>;
