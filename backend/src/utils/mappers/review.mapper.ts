// src/utils/mappers/review.mapper.ts
//
// Pure DTO mappers for the review domain. Services return Prisma rows (with
// `reviewInclude` relations); controllers map them through here so the wire
// format lives in exactly one place and raw DB records never leak.
//
// Two shapes on purpose:
//   - ReviewDTO (authed surface) carries the customer summary and moderation
//     status.
//   - PublicReviewDTO (unauthenticated browse surface) carries the reviewer's
//     display name ONLY — no customer id, no email, no booking details beyond
//     the reviewed target.
import type { Prisma } from '#config/prismaClient.js';

import { BadRequestError } from '#middlewares/error-handler.js';

/** Aggregate rating block carried by tour/hotel/flight DTOs. */
export interface RatingSummary {
  /** Mean of PUBLISHED review ratings, 1 decimal; null when there are none. */
  average: null | number;
  count: number;
}

/** The rating block for an unreviewed item. */
export const EMPTY_RATING: RatingSummary = { average: null, count: 0 };

/**
 * Relations every review read/mutation fetches; services pass this to Prisma.
 * The booking block exists only to derive the review's target — reviews have
 * no target columns of their own.
 */
export const reviewInclude = {
  booking: {
    select: {
      flight: { select: { airline: true, flightNumber: true, id: true } },
      id: true,
      room: {
        select: {
          hotel: { select: { id: true, name: true } },
          id: true,
          roomType: true,
        },
      },
      tour: { select: { id: true, name: true } },
    },
  },
  customer: { select: { id: true, name: true } },
} satisfies Prisma.ReviewInclude;

/** Unauthenticated shape: reviewer display name only, no principal ids. */
export interface PublicReviewDTO {
  comment: null | string;
  createdAt: Date;
  id: number;
  rating: number;
  reviewer: string;
  target: ReviewTargetDTO;
  title: null | string;
}

/** Authed (customer/staff) shape. */
export interface ReviewDTO {
  bookingId: number;
  comment: null | string;
  createdAt: Date;
  customer: ReviewWithRelations['customer'];
  id: number;
  rating: number;
  status: ReviewWithRelations['status'];
  target: ReviewTargetDTO;
  title: null | string;
  updatedAt: Date;
}

/** What the reviewed booking targeted, derived from its relations. */
export type ReviewTargetDTO =
  | {
      airline: string;
      flightNumber: string;
      id: number;
      type: 'FLIGHT';
    }
  | {
      hotel: { id: number; name: string };
      id: number;
      roomType: string;
      type: 'ROOM';
    }
  | { id: number; name: string; type: 'TOUR' };

export type ReviewWithRelations = Prisma.ReviewGetPayload<{
  include: typeof reviewInclude;
}>;

/**
 * Derives the review's target from the booking's relations (same TOUR / ROOM
 * / FLIGHT precedence as the booking mapper). A booking always has exactly
 * one target; the throw is a fail-closed guard, not a reachable branch.
 */
export const toReviewTargetDTO = (
  booking: ReviewWithRelations['booking'],
): ReviewTargetDTO => {
  if (booking.tour) {
    return { id: booking.tour.id, name: booking.tour.name, type: 'TOUR' };
  }
  if (booking.room) {
    return {
      hotel: booking.room.hotel,
      id: booking.room.id,
      roomType: booking.room.roomType,
      type: 'ROOM',
    };
  }
  if (booking.flight) {
    return {
      airline: booking.flight.airline,
      flightNumber: booking.flight.flightNumber,
      id: booking.flight.id,
      type: 'FLIGHT',
    };
  }
  throw new BadRequestError(
    'Review booking has no associated item (tour, room, or flight)',
  );
};

export const toReviewDTO = (review: ReviewWithRelations): ReviewDTO => ({
  bookingId: review.bookingId,
  comment: review.comment,
  createdAt: review.createdAt,
  customer: review.customer,
  id: review.id,
  rating: review.rating,
  status: review.status,
  target: toReviewTargetDTO(review.booking),
  title: review.title,
  updatedAt: review.updatedAt,
});

export const toPublicReviewDTO = (
  review: ReviewWithRelations,
): PublicReviewDTO => ({
  comment: review.comment,
  createdAt: review.createdAt,
  id: review.id,
  rating: review.rating,
  reviewer: review.customer.name,
  target: toReviewTargetDTO(review.booking),
  title: review.title,
});
