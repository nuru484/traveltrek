// src/components/reviews/review-logic.ts
//
// Pure review rules — schema and window math kept out of the dialog so
// they're unit-testable. Mirrors backend review-validation.ts (rating 1–5
// integer, title ≤120, comment ≤2000) and review.service.ts (30-day edit
// window; only COMPLETED bookings are reviewable, one review per booking).
import { z } from "zod";
import type { IReview, IReviewTarget } from "@/types/review.types";
import type { IBooking } from "@/types/booking.types";

export const reviewFormSchema = z.object({
  rating: z
    .number({ message: "Pick a star rating" })
    .int("Pick a star rating")
    .min(1, "Pick a star rating")
    .max(5, "Rating must be between 1 and 5"),
  title: z
    .string()
    .trim()
    .max(120, "Title must not exceed 120 characters")
    .optional(),
  comment: z
    .string()
    .trim()
    .max(2000, "Comment must not exceed 2000 characters")
    .optional(),
});

export type ReviewFormValues = z.infer<typeof reviewFormSchema>;

/** Days a customer may edit their review after posting (backend rule). */
export const EDIT_WINDOW_DAYS = 30;

/** Whether the 30-day edit window is still open for a review. */
export function canEditReview(createdAt: string, now: Date = new Date()): boolean {
  const posted = new Date(createdAt).getTime();
  if (Number.isNaN(posted)) return false;
  const windowMs = EDIT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  return now.getTime() - posted <= windowMs;
}

/** The customer's review of a booking, if they've written one. */
export function findReviewForBooking(
  reviews: IReview[] | undefined,
  bookingId: number
): IReview | undefined {
  return reviews?.find((review) => review.bookingId === bookingId);
}

/** Only completed trips can be reviewed (backend own-COMPLETED rule). */
export function isReviewableBooking(booking: Pick<IBooking, "status">): boolean {
  return booking.status === "COMPLETED";
}

/** One human line naming what a review targets, shared by every surface. */
export function reviewTargetLabel(target: IReviewTarget): string {
  switch (target.type) {
    case "TOUR":
      return target.name;
    case "ROOM":
      return `${target.hotel.name} · ${target.roomType}`;
    case "FLIGHT":
      return `${target.airline} · ${target.flightNumber}`;
  }
}

/** Dashboard detail path for a review's target (rooms land on the room). */
export function reviewTargetHref(target: IReviewTarget): string {
  switch (target.type) {
    case "TOUR":
      return `/dashboard/tours/${target.id}/detail`;
    case "ROOM":
      return `/dashboard/rooms/${target.id}/detail`;
    case "FLIGHT":
      return `/dashboard/flights/${target.id}/detail`;
  }
}
