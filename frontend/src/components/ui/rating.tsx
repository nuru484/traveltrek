// src/components/ui/rating.tsx
//
// The one star-rating vocabulary, shared by dashboard cards/details and the
// public landing page. Two pieces:
//   - RatingStars: read-only summary (star + average + count) for the
//     RatingSummary aggregate every tour/hotel/flight DTO carries.
//   - RatingStarsInput: the interactive 1–5 picker the review dialog uses.
"use client";
import { Star } from "lucide-react";
import type { IRatingSummary } from "@/types/review.types";
import { cn } from "@/lib/utils";

interface IRatingStarsProps {
  rating: IRatingSummary;
  /** Hide the "(n)" count — for very tight spots. */
  hideCount?: boolean;
  className?: string;
}

/**
 * Compact aggregate: one filled star, the average to 1 decimal and the
 * review count. Unreviewed items (average null) render a muted "No reviews
 * yet" so cards keep a stable row without faking a zero score.
 */
export function RatingStars({ rating, hideCount, className }: IRatingStarsProps) {
  if (rating.average === null || rating.count === 0) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 text-muted-foreground",
          className
        )}
      >
        <Star className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
        <span className="text-xs">No reviews yet</span>
      </span>
    );
  }

  return (
    <span
      className={cn("inline-flex items-center gap-1", className)}
      aria-label={`Rated ${rating.average} out of 5 from ${rating.count} review${
        rating.count === 1 ? "" : "s"
      }`}
    >
      <Star
        className="h-3.5 w-3.5 fill-secondary text-secondary"
        strokeWidth={1.5}
        aria-hidden
      />
      <span className="text-xs font-semibold text-foreground">
        {rating.average.toFixed(1)}
      </span>
      {!hideCount && (
        <span className="text-xs text-muted-foreground">({rating.count})</span>
      )}
    </span>
  );
}

/** A single review's own 1–5 score as a filled/empty star row. */
export function RatingValue({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  return (
    <span
      className={cn("inline-flex items-center gap-0.5", className)}
      role="img"
      aria-label={`${value} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            "h-3.5 w-3.5",
            star <= value
              ? "fill-secondary text-secondary"
              : "text-muted-foreground/40"
          )}
          strokeWidth={1.5}
          aria-hidden
        />
      ))}
    </span>
  );
}

interface IRatingStarsInputProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  className?: string;
}

/** Interactive 1–5 star picker (radio group semantics) for the review form. */
export function RatingStarsInput({
  value,
  onChange,
  disabled,
  className,
}: IRatingStarsInputProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Rating"
      className={cn("flex items-center gap-1", className)}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} star${star === 1 ? "" : "s"}`}
          disabled={disabled}
          onClick={() => onChange(star)}
          className="cursor-pointer rounded-sm p-0.5 transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Star
            className={cn(
              "h-6 w-6 transition-colors",
              star <= value
                ? "fill-secondary text-secondary"
                : "text-muted-foreground/50"
            )}
            strokeWidth={1.5}
            aria-hidden
          />
        </button>
      ))}
    </div>
  );
}
