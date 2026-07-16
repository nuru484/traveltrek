// test/unit/review-logic.test.ts
//
// Pure review rules: the form schema mirrors backend review-validation.ts
// (rating 1–5 integer, title ≤120, comment ≤2000) and the 30-day edit
// window mirrors review.service.ts.
import { describe, expect, it } from "vitest";
import {
  canEditReview,
  findReviewForBooking,
  isReviewableBooking,
  reviewFormSchema,
  reviewTargetHref,
  reviewTargetLabel,
} from "@/components/reviews/review-logic";
import type { IReview } from "@/types/review.types";

const DAY_MS = 24 * 60 * 60 * 1000;

const reviewOf = (overrides: Partial<IReview>): IReview => ({
  id: 1,
  bookingId: 10,
  rating: 4,
  title: null,
  comment: null,
  status: "PENDING",
  customer: { id: 7, name: "Ama Serwaa" },
  target: { type: "TOUR", id: 3, name: "Mole Safari" },
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
  ...overrides,
});

describe("reviewFormSchema", () => {
  it("accepts a full valid review", () => {
    const result = reviewFormSchema.safeParse({
      rating: 5,
      title: "Great trip",
      comment: "Would go again.",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a rating-only review (title/comment optional)", () => {
    expect(reviewFormSchema.safeParse({ rating: 3 }).success).toBe(true);
  });

  it.each([0, 6, -1])("rejects out-of-range rating %s", (rating) => {
    expect(reviewFormSchema.safeParse({ rating }).success).toBe(false);
  });

  it("rejects a non-integer rating", () => {
    expect(reviewFormSchema.safeParse({ rating: 3.5 }).success).toBe(false);
  });

  it("rejects a missing rating", () => {
    expect(reviewFormSchema.safeParse({ title: "No stars" }).success).toBe(
      false
    );
  });

  it("enforces title and comment length caps", () => {
    expect(
      reviewFormSchema.safeParse({ rating: 4, title: "x".repeat(121) })
        .success
    ).toBe(false);
    expect(
      reviewFormSchema.safeParse({ rating: 4, comment: "x".repeat(2001) })
        .success
    ).toBe(false);
    expect(
      reviewFormSchema.safeParse({
        rating: 4,
        title: "x".repeat(120),
        comment: "x".repeat(2000),
      }).success
    ).toBe(true);
  });
});

describe("canEditReview", () => {
  const now = new Date("2026-07-16T12:00:00.000Z");

  it("allows edits inside the 30-day window", () => {
    const posted = new Date(now.getTime() - 29 * DAY_MS).toISOString();
    expect(canEditReview(posted, now)).toBe(true);
  });

  it("blocks edits after 30 days", () => {
    const posted = new Date(now.getTime() - 31 * DAY_MS).toISOString();
    expect(canEditReview(posted, now)).toBe(false);
  });

  it("fails closed on an unparseable date", () => {
    expect(canEditReview("not-a-date", now)).toBe(false);
  });
});

describe("findReviewForBooking / isReviewableBooking", () => {
  it("finds the review belonging to a booking", () => {
    const reviews = [reviewOf({ id: 1, bookingId: 10 }), reviewOf({ id: 2, bookingId: 11 })];
    expect(findReviewForBooking(reviews, 11)?.id).toBe(2);
    expect(findReviewForBooking(reviews, 12)).toBeUndefined();
    expect(findReviewForBooking(undefined, 10)).toBeUndefined();
  });

  it("only COMPLETED bookings are reviewable", () => {
    expect(isReviewableBooking({ status: "COMPLETED" })).toBe(true);
    expect(isReviewableBooking({ status: "CONFIRMED" })).toBe(false);
    expect(isReviewableBooking({ status: "PENDING" })).toBe(false);
    expect(isReviewableBooking({ status: "CANCELLED" })).toBe(false);
  });
});

describe("review target display", () => {
  it("labels and links each target kind", () => {
    expect(
      reviewTargetLabel({ type: "TOUR", id: 3, name: "Mole Safari" })
    ).toBe("Mole Safari");
    expect(
      reviewTargetLabel({
        type: "ROOM",
        id: 8,
        roomType: "Deluxe",
        hotel: { id: 2, name: "Zaina Lodge" },
      })
    ).toBe("Zaina Lodge · Deluxe");
    expect(
      reviewTargetLabel({
        type: "FLIGHT",
        id: 5,
        airline: "Passion Air",
        flightNumber: "OP-321",
      })
    ).toBe("Passion Air · OP-321");

    expect(reviewTargetHref({ type: "TOUR", id: 3, name: "x" })).toBe(
      "/dashboard/tours/3/detail"
    );
    expect(
      reviewTargetHref({
        type: "ROOM",
        id: 8,
        roomType: "Deluxe",
        hotel: { id: 2, name: "x" },
      })
    ).toBe("/dashboard/rooms/8/detail");
    expect(
      reviewTargetHref({
        type: "FLIGHT",
        id: 5,
        airline: "x",
        flightNumber: "y",
      })
    ).toBe("/dashboard/flights/5/detail");
  });
});
