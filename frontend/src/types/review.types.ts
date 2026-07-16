// src/types/review.types.ts
//
// Mirrors backend review.mapper.ts: ReviewDTO (authed surface), PublicReviewDTO
// (unauthenticated browse surface) and the RatingSummary aggregate carried by
// tour/hotel/flight DTOs.

/** Aggregate of PUBLISHED reviews carried by tour/hotel/flight DTOs. */
export interface IRatingSummary {
  /** Mean rating to 1 decimal; null when there are no published reviews. */
  average: number | null;
  count: number;
}

export type ReviewStatus = "PENDING" | "PUBLISHED" | "HIDDEN";

/** What the reviewed booking targeted (backend ReviewTargetDTO). */
export type IReviewTarget =
  | { type: "TOUR"; id: number; name: string }
  | {
      type: "ROOM";
      id: number;
      roomType: string;
      hotel: { id: number; name: string };
    }
  | { type: "FLIGHT"; id: number; airline: string; flightNumber: string };

/** Authed shape (customer/staff surfaces). */
export interface IReview {
  id: number;
  bookingId: number;
  rating: number;
  title: string | null;
  comment: string | null;
  status: ReviewStatus;
  customer: { id: number; name: string };
  target: IReviewTarget;
  createdAt: string;
  updatedAt: string;
}

/** Unauthenticated shape: reviewer display name only. */
export interface IPublicReview {
  id: number;
  rating: number;
  title: string | null;
  comment: string | null;
  reviewer: string;
  target: IReviewTarget;
  createdAt: string;
}

export interface IReviewResponse {
  message: string;
  data: IReview;
}

export interface IReviewsPaginatedResponse {
  message: string;
  data: IReview[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface IReviewsQueryParams {
  page?: number;
  limit?: number;
  status?: ReviewStatus;
  rating?: number;
  search?: string;
}

export interface ICreateReviewInput {
  bookingId: number;
  rating: number;
  title?: string;
  comment?: string;
}

export interface IUpdateReviewInput {
  id: number;
  rating?: number;
  title?: string;
  comment?: string;
}
