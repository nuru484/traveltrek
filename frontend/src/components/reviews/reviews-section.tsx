// src/components/reviews/reviews-section.tsx
//
// Read-only "what guests said" block for tour/hotel/flight detail pages.
// Fed by the public detail endpoint, which embeds the first 5 published
// reviews plus the total — enough for a detail page; no load-more endpoint
// exists (or is needed) beyond that.
"use client";
import { format } from "date-fns";
import { MessageSquare } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { RatingValue } from "@/components/ui/rating";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useGetPublicItemReviewsQuery,
  type PublicReviewTargetKind,
} from "@/redux/reviewApi";

interface IReviewsSectionProps {
  kind: PublicReviewTargetKind;
  id: number;
}

export function ReviewsSection({ kind, id }: IReviewsSectionProps) {
  const { data, isLoading, isError } = useGetPublicItemReviewsQuery({
    kind,
    id,
  });

  // A hiccup on this read-only garnish shouldn't add error chrome to the
  // detail page — the section simply stays out of the way.
  if (isError) return null;

  const reviews = data?.reviews ?? [];
  const total = data?.reviewsTotal ?? 0;

  return (
    <Card className="py-0 max-sm:rounded-none max-sm:border-x-0 max-sm:bg-transparent">
      <CardContent className="p-4 sm:p-6 max-sm:px-3">
        <div className="mb-4 flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">
            Reviews{total > 0 ? ` (${total})` : ""}
          </h2>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[0, 1].map((row) => (
              <div key={row} className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-full max-w-md" />
              </div>
            ))}
          </div>
        ) : reviews.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No published reviews yet — completed trips can be reviewed by the
            traveller.
          </p>
        ) : (
          <ul className="space-y-5">
            {reviews.map((review, index) => (
              <li
                key={review.id}
                className={
                  index > 0
                    ? "border-t border-dashed border-foreground/15 pt-5"
                    : undefined
                }
              >
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <RatingValue value={review.rating} />
                  <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                    {format(new Date(review.createdAt), "MMM d, yyyy")}
                  </span>
                </div>
                {review.title && (
                  <p className="mt-2 font-semibold break-words [overflow-wrap:anywhere]">
                    {review.title}
                  </p>
                )}
                {review.comment && (
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground break-words [overflow-wrap:anywhere]">
                    {review.comment}
                  </p>
                )}
                <p className="mt-2 text-xs text-muted-foreground break-words [overflow-wrap:anywhere]">
                  — {review.reviewer}
                </p>
              </li>
            ))}
          </ul>
        )}

        {total > reviews.length && reviews.length > 0 && (
          <p className="mt-5 border-t border-dashed border-foreground/15 pt-4 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            Showing {reviews.length} of {total} published reviews
          </p>
        )}
      </CardContent>
    </Card>
  );
}
