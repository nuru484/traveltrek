// src/components/reviews/review-dialog.tsx
//
// Create/edit dialog for a customer's review of a COMPLETED booking:
// star-rating input, optional title and comment. Create POSTs /reviews
// (one per booking, enforced server-side); edit PUTs /reviews/:id within
// the 30-day window.
"use client";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { FormRootError } from "@/components/ui/form-root-error";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RatingStarsInput } from "@/components/ui/rating";
import {
  useCreateReviewMutation,
  useUpdateReviewMutation,
} from "@/redux/reviewApi";
import type { IReview } from "@/types/review.types";
import { applyServerFieldErrors } from "@/utils/apply-server-field-errors";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import { reviewFormSchema, ReviewFormValues } from "./review-logic";

interface IReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Required in create mode: the COMPLETED booking being reviewed. */
  bookingId?: number;
  /** Present in edit mode: the review being amended. */
  review?: IReview;
  /** What's being reviewed, for the dialog copy (e.g. the tour name). */
  targetLabel?: string;
}

export function ReviewDialog({
  open,
  onOpenChange,
  bookingId,
  review,
  targetLabel,
}: IReviewDialogProps) {
  const isEdit = Boolean(review);
  const [createReview, { isLoading: isCreating }] = useCreateReviewMutation();
  const [updateReview, { isLoading: isUpdating }] = useUpdateReviewMutation();
  const isLoading = isCreating || isUpdating;

  const form = useForm<ReviewFormValues>({
    resolver: zodResolver(reviewFormSchema),
    defaultValues: {
      rating: review?.rating ?? 0,
      title: review?.title ?? "",
      comment: review?.comment ?? "",
    },
  });

  // Re-hydrate whenever the dialog opens (possibly for a different review).
  useEffect(() => {
    if (open) {
      form.reset({
        rating: review?.rating ?? 0,
        title: review?.title ?? "",
        comment: review?.comment ?? "",
      });
    }
  }, [open, review, form]);

  const onSubmit = async (values: ReviewFormValues) => {
    try {
      const body = {
        rating: values.rating,
        title: values.title || undefined,
        comment: values.comment || undefined,
      };
      if (isEdit && review) {
        await updateReview({ id: review.id, ...body }).unwrap();
        toast.success("Review updated");
      } else if (bookingId) {
        await createReview({ bookingId, ...body }).unwrap();
        toast.success("Thanks for your review!");
      }
      onOpenChange(false);
    } catch (error) {
      const { message, fieldErrors, hasFieldErrors } =
        extractApiErrorMessage(error);
      const fallback = `Failed to ${isEdit ? "update" : "submit"} review`;

      if (hasFieldErrors && fieldErrors) {
        const unmatched = applyServerFieldErrors(form.setError, fieldErrors, [
          "rating",
          "title",
          "comment",
        ]);
        if (unmatched.length > 0) {
          form.setError("root", { message: unmatched.join(" ") });
        }
      } else {
        // No field to attach it to (e.g. "already reviewed"): keep the
        // error visible in the dialog after the toast fades.
        form.setError("root", { message: message || fallback });
      }

      toast.error(message || fallback);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit your review" : "Leave a review"}
          </DialogTitle>
          <DialogDescription className="break-words [overflow-wrap:anywhere]">
            {targetLabel
              ? `How was ${targetLabel}?`
              : "How was your trip? Your review appears once it's published."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="rating"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rating</FormLabel>
                  <FormControl>
                    <RatingStarsInput
                      value={field.value}
                      onChange={field.onChange}
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Unforgettable trip"
                      maxLength={120}
                      {...field}
                      value={field.value ?? ""}
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="comment"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Comment (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Tell other travellers how it went…"
                      rows={4}
                      maxLength={2000}
                      {...field}
                      value={field.value ?? ""}
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Server errors that belong to no single field stay visible
                here after the toast fades. */}
            <FormRootError />

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
                className="cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                className="cursor-pointer"
              >
                {isLoading && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {isEdit ? "Save changes" : "Submit review"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
