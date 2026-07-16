// src/components/reviews/booking-review-card.tsx
//
// The customer's review affordance on their own booking detail page:
//   - COMPLETED + not yet reviewed → "Leave a review" call-to-action.
//   - Already reviewed → "Your review" display with edit (within the 30-day
//     window) and delete.
// Renders nothing for staff or for bookings that can't be reviewed.
"use client";
import { useState } from "react";
import { format } from "date-fns";
import { Edit, Star, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { useSelector } from "react-redux";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { RatingValue } from "@/components/ui/rating";
import {
  useDeleteReviewMutation,
  useGetMyReviewsQuery,
} from "@/redux/reviewApi";
import type { RootState } from "@/redux/store";
import type { IBooking } from "@/types/booking.types";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import { isCustomer } from "@/utils/roles";
import { ReviewDialog } from "./review-dialog";
import {
  canEditReview,
  findReviewForBooking,
  isReviewableBooking,
  reviewTargetLabel,
} from "./review-logic";

const REVIEW_STATUS_COPY: Record<string, string> = {
  PENDING: "Awaiting moderation",
  PUBLISHED: "Published",
  HIDDEN: "Hidden by staff",
};

export function BookingReviewCard({ booking }: { booking: IBooking }) {
  const user = useSelector((state: RootState) => state.auth.user);
  const customer = isCustomer(user);
  const ownBooking = customer && booking.customerId === Number(user?.id);

  const [showDialog, setShowDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteReview, { isLoading: isDeleting }] = useDeleteReviewMutation();

  // One page is plenty: a customer's review count is bounded by their
  // completed bookings; the backend caps limit at 100.
  const { data: myReviewsData } = useGetMyReviewsQuery(
    { page: 1, limit: 100 },
    { skip: !ownBooking }
  );

  if (!ownBooking) return null;

  const review = findReviewForBooking(myReviewsData?.data, booking.id);
  const reviewable = isReviewableBooking(booking);

  if (!review && !reviewable) return null;

  const handleDelete = async () => {
    if (!review) return;
    try {
      await deleteReview(review.id).unwrap();
      toast.success("Review deleted");
      setShowDeleteDialog(false);
    } catch (error) {
      const { message } = extractApiErrorMessage(error);
      toast.error(message || "Failed to delete review");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Star className="h-5 w-5 text-primary" />
          {review ? "Your review" : "How was your trip?"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {review ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <RatingValue value={review.rating} />
              <Badge variant="outline">
                {REVIEW_STATUS_COPY[review.status] ?? review.status}
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
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
              Posted {format(new Date(review.createdAt), "MMM d, yyyy")}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {canEditReview(review.createdAt) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDialog(true)}
                  className="cursor-pointer"
                >
                  <Edit className="mr-1.5 h-3.5 w-3.5" />
                  Edit
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDeleteDialog(true)}
                disabled={isDeleting}
                className="cursor-pointer text-destructive hover:text-destructive"
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Delete
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 min-[480px]:flex-row min-[480px]:items-center min-[480px]:justify-between">
            <p className="text-sm text-muted-foreground">
              Your trip is complete — tell other travellers how it went.
            </p>
            <Button
              size="sm"
              onClick={() => setShowDialog(true)}
              className="cursor-pointer whitespace-nowrap"
            >
              <Star className="mr-1.5 h-3.5 w-3.5" />
              Leave a review
            </Button>
          </div>
        )}

        <ReviewDialog
          open={showDialog}
          onOpenChange={setShowDialog}
          bookingId={booking.id}
          review={review}
          targetLabel={review ? reviewTargetLabel(review.target) : undefined}
        />

        <ConfirmationDialog
          open={showDeleteDialog}
          onOpenChange={setShowDeleteDialog}
          title="Delete Review"
          description="Are you sure you want to delete your review? This action cannot be undone."
          onConfirm={handleDelete}
          confirmText="Delete"
          isDestructive
        />
      </CardContent>
    </Card>
  );
}
