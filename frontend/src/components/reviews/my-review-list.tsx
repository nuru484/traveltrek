// src/components/reviews/my-review-list.tsx
//
// The customer's own reviews (GET /reviews/mine): every review they've
// written, with edit (30-day window) and delete, plus its moderation status
// so they know whether it's visible yet.
"use client";
import { useState } from "react";
import { format } from "date-fns";
import { Edit, Trash2 } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import EmptyState from "@/components/ui/EmptyState";
import ErrorMessage from "@/components/ui/ErrorMessage";
import Pagination from "@/components/ui/Pagination";
import { RatingValue } from "@/components/ui/rating";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useDeleteReviewMutation,
  useGetMyReviewsQuery,
} from "@/redux/reviewApi";
import type { IReview } from "@/types/review.types";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import { ReviewDialog } from "./review-dialog";
import {
  canEditReview,
  reviewTargetHref,
  reviewTargetLabel,
} from "./review-logic";

const STATUS_COPY: Record<string, string> = {
  PENDING: "Awaiting moderation",
  PUBLISHED: "Published",
  HIDDEN: "Hidden by staff",
};

export function MyReviewList() {
  const [page, setPage] = useState(1);
  const [editTarget, setEditTarget] = useState<IReview | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<IReview | null>(null);

  const { data, isLoading, isError, error, refetch } = useGetMyReviewsQuery({
    page,
    limit: 10,
  });
  const [deleteReview, { isLoading: isDeleting }] = useDeleteReviewMutation();

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteReview(deleteTarget.id).unwrap();
      toast.success("Review deleted");
      setDeleteTarget(null);
    } catch (err) {
      const { message } = extractApiErrorMessage(err);
      toast.error(message || "Failed to delete review");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="space-y-2.5 rounded-xl border border-foreground/15 bg-card p-4 sm:p-5"
          >
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-40" />
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    const errorMessage = extractApiErrorMessage(error).message;
    return <ErrorMessage error={errorMessage} onRetry={refetch} />;
  }

  const reviews = data?.data ?? [];
  const meta = data?.meta ?? { total: 0, page: 1, limit: 10, totalPages: 0 };

  if (reviews.length === 0) {
    return (
      <EmptyState
        title="No reviews yet"
        description="Once a trip is completed you can review it from the booking's page — your reviews will collect here."
      />
    );
  }

  return (
    <div className="space-y-6">
      <ul className="space-y-3">
        {reviews.map((review) => (
          <li
            key={review.id}
            className="rounded-xl border border-foreground/15 bg-card p-4 sm:p-5"
          >
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <RatingValue value={review.rating} />
                <Badge variant="outline">
                  {STATUS_COPY[review.status] ?? review.status}
                </Badge>
              </div>
              {review.title && (
                <p className="font-semibold break-words [overflow-wrap:anywhere]">
                  {review.title}
                </p>
              )}
              {review.comment && (
                <p className="text-sm leading-relaxed text-muted-foreground break-words [overflow-wrap:anywhere]">
                  {review.comment}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                <Link
                  href={reviewTargetHref(review.target)}
                  className="min-w-0 break-words [overflow-wrap:anywhere] text-foreground/70 underline-offset-4 transition-colors hover:text-foreground hover:underline"
                >
                  {reviewTargetLabel(review.target)}
                </Link>
                <span aria-hidden>·</span>
                <span>{format(new Date(review.createdAt), "MMM d, yyyy")}</span>
              </div>
              <div className="flex flex-wrap gap-2 pt-1.5">
                {canEditReview(review.createdAt) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditTarget(review)}
                    className="cursor-pointer"
                  >
                    <Edit className="mr-1.5 h-3.5 w-3.5" />
                    Edit
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleteTarget(review)}
                  disabled={isDeleting}
                  className="cursor-pointer text-destructive hover:text-destructive"
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Delete
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <Pagination meta={meta} onPageChange={setPage} />

      <ReviewDialog
        open={editTarget !== null}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
        review={editTarget ?? undefined}
        targetLabel={editTarget ? reviewTargetLabel(editTarget.target) : undefined}
      />

      <ConfirmationDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setDeleteTarget(null);
        }}
        title="Delete Review"
        description="Are you sure you want to delete your review? This action cannot be undone."
        onConfirm={handleDelete}
        confirmText="Delete"
        isDestructive
      />
    </div>
  );
}
