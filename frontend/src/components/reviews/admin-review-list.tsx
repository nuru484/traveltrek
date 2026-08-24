// src/components/reviews/admin-review-list.tsx
//
// Staff moderation surface (GET /reviews): status/rating/search filters over
// a RowCard-style list. ADMINs publish/hide (PATCH /reviews/:id/status) and
// delete (with confirmation); AGENTs read. Reviews are moderated PENDING →
// PUBLISHED before they appear anywhere public.
"use client";
import { useState } from "react";
import { format } from "date-fns";
import { Eye, EyeOff, MoreHorizontal, Trash2 } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import EmptyState from "@/components/ui/EmptyState";
import ErrorMessage from "@/components/ui/ErrorMessage";
import Pagination from "@/components/ui/Pagination";
import { RatingValue } from "@/components/ui/rating";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useDeleteReviewMutation,
  useGetAllReviewsQuery,
  useUpdateReviewStatusMutation,
} from "@/redux/reviewApi";
import type { IReview, ReviewStatus } from "@/types/review.types";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import { hasActiveFilterValues } from "@/utils/active-filters";
import { useTableQueryState } from "@/hooks/use-table-query-state";
import type { TableFiltersSpec } from "@/hooks/table-query-state-logic";
import { ReviewComment } from "./review-comment";
import { ReviewFilters } from "./ReviewFilters";
import { reviewTargetHref, reviewTargetLabel } from "./review-logic";

const REVIEW_STATUSES = ["PENDING", "PUBLISHED", "HIDDEN"] as const;

// A type alias (not interface) so it satisfies the hook's Record constraint.
type IReviewsTableFilters = {
  search?: string;
  status?: ReviewStatus;
  rating?: number;
};

const FILTERS_SPEC: TableFiltersSpec<IReviewsTableFilters> = {
  search: { kind: "string" },
  status: { kind: "enum", values: REVIEW_STATUSES },
  rating: { kind: "number" },
};

const STATUS_VARIANT: Record<
  ReviewStatus,
  "default" | "secondary" | "outline"
> = {
  PENDING: "secondary",
  PUBLISHED: "default",
  HIDDEN: "outline",
};

export function AdminReviewList({ isAdmin }: { isAdmin: boolean }) {
  const [deleteTarget, setDeleteTarget] = useState<IReview | null>(null);

  // URL + session table state: deep links win, and navigating away and back
  // restores the page and filters that were in effect.
  const { filters, queryParams, handlePageChange, handleFiltersChange } =
    useTableQueryState<IReviewsTableFilters>({ spec: FILTERS_SPEC });

  const { data, isLoading, isError, error, refetch } =
    useGetAllReviewsQuery(queryParams);

  const [updateStatus] = useUpdateReviewStatusMutation();
  const [deleteReview, { isLoading: isDeleting }] = useDeleteReviewMutation();

  const handleStatusChange = async (review: IReview, status: ReviewStatus) => {
    try {
      await updateStatus({ id: review.id, status }).unwrap();
      toast.success(
        status === "PUBLISHED" ? "Review published" : "Review hidden"
      );
    } catch (err) {
      const { message } = extractApiErrorMessage(err);
      toast.error(message || "Failed to update review status");
    }
  };

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
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Skeleton className="h-10 w-full lg:max-w-xs" />
          <Skeleton className="h-10 w-36 rounded-lg" />
        </div>
        <div className="grid gap-3 @2xl/main:grid-cols-2 @5xl/main:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="space-y-2.5 rounded-xl border border-foreground/15 bg-card p-4 sm:p-5"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="h-8 w-8 rounded-md" />
              </div>
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-40" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    const errorMessage = extractApiErrorMessage(error).message;
    return <ErrorMessage error={errorMessage} onRetry={refetch} />;
  }

  const reviews = data?.data ?? [];
  const meta = data?.meta ?? { total: 0, page: 1, limit: 10, totalPages: 0 };
  const hasActiveFilters = hasActiveFilterValues(filters);

  // No reviews exist at all (not a filtered miss): a lone EmptyState replaces
  // the filter bar and results count — filters over nothing are pointless.
  // No create action here: reviews arrive from customers rating completed
  // bookings, staff never create them.
  if (meta.total === 0 && !hasActiveFilters) {
    return (
      <EmptyState
        title="No reviews yet."
        description="Reviews appear here once customers rate their completed bookings."
      />
    );
  }

  return (
    <div className="space-y-6">
      <ReviewFilters filters={filters} onFiltersChange={handleFiltersChange} />

      <p className="text-xs sm:text-sm text-muted-foreground">
        {meta.total} review{meta.total !== 1 ? "s" : ""} found
      </p>

      {reviews.length === 0 ? (
        <EmptyState
          title="No reviews match"
          description="Reviews appear here once customers rate their completed bookings."
        />
      ) : (
        <ul className="grid gap-3 @2xl/main:grid-cols-2 @5xl/main:grid-cols-3">
          {reviews.map((review) => (
            <li
              key={review.id}
              className="flex h-full flex-col rounded-xl border border-foreground/15 bg-card p-4 sm:p-5"
            >
              {/* Row 1: rating + status left, admin actions right. The body
                  below spans the full card width so the actions button never
                  reserves a column of its own. */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <RatingValue value={review.rating} />
                  <Badge variant={STATUS_VARIANT[review.status]}>
                    {review.status}
                  </Badge>
                </div>

                {isAdmin && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 flex-none cursor-pointer"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Review actions</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      {review.status !== "PUBLISHED" && (
                        <DropdownMenuItem
                          onClick={() =>
                            handleStatusChange(review, "PUBLISHED")
                          }
                          className="cursor-pointer"
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          Publish
                        </DropdownMenuItem>
                      )}
                      {review.status !== "HIDDEN" && (
                        <DropdownMenuItem
                          onClick={() => handleStatusChange(review, "HIDDEN")}
                          className="cursor-pointer"
                        >
                          <EyeOff className="mr-2 h-4 w-4" />
                          Hide
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={() => setDeleteTarget(review)}
                        className="text-destructive focus:text-destructive cursor-pointer"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>

              <div className="mt-2 flex flex-1 flex-col gap-2">
                {review.title && (
                  <p className="font-semibold [overflow-wrap:anywhere]">
                    {review.title}
                  </p>
                )}
                {review.comment && <ReviewComment comment={review.comment} />}
                <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  <span className="[overflow-wrap:anywhere]">
                    By {review.customer.name}
                  </span>
                  <span aria-hidden>·</span>
                  <Link
                    href={reviewTargetHref(review.target)}
                    className="min-w-0 [overflow-wrap:anywhere] text-foreground/70 underline-offset-4 transition-colors hover:text-foreground hover:underline"
                  >
                    {reviewTargetLabel(review.target)}
                  </Link>
                  <span aria-hidden>·</span>
                  <span>
                    {format(new Date(review.createdAt), "MMM d, yyyy")}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Pagination meta={meta} onPageChange={handlePageChange} />

      <ConfirmationDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setDeleteTarget(null);
        }}
        title="Delete Review"
        description={`Are you sure you want to delete ${
          deleteTarget ? `${deleteTarget.customer.name}'s` : "this"
        } review? This action cannot be undone.`}
        onConfirm={handleDelete}
        confirmText="Delete"
        isDestructive
      />
    </div>
  );
}
