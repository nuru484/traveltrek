// src/app/dashboard/bookings/[id]/page.tsx
"use client";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import ErrorMessage from "@/components/ui/ErrorMessage";
import { useParams } from "next/navigation";
import { useGetBookingQuery } from "@/redux/bookingApi";
import BookingDetailView from "@/components/bookings/BookingDetailView";
import BookingDetailViewSkeleton from "@/components/bookings/BookingDetailViewSkeleton";
import DetailPageHeader from "@/components/ui/DetailPageHeader";
import { BookingReviewCard } from "@/components/reviews/booking-review-card";
import { CancelBookingButton } from "@/components/bookings/CancelBookingButton";

const BookingDetailPage = () => {
  const params = useParams<{ id: string }>();
  const bookingId = parseInt(params.id, 10);

  const {
    data: bookingData,
    error,
    isError,
    isLoading,
    refetch,
  } = useGetBookingQuery({
    bookingId,
  });

  const booking = bookingData?.data;
  const errorMessage = extractApiErrorMessage(error).message;


  if (isLoading) return <BookingDetailViewSkeleton />;

  if (isError || !booking)
    return <ErrorMessage error={errorMessage} onRetry={refetch} />;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      {/* Responsive Page Header */}
      <DetailPageHeader
        title="Booking details"
        description="View booking information and customer details"
        backHref="/dashboard/bookings"
        backLabel="Back to bookings"
      />

      {/* Cancel action — customers on their own booking, staff on any;
          hidden for terminal/started bookings (booking-cancel-logic). */}
      <div className="flex justify-end">
        <CancelBookingButton booking={booking} />
      </div>

      {/* Booking Detail Component */}
      <BookingDetailView booking={booking} />

      {/* Customer-only: leave / manage the review for this booking */}
      <BookingReviewCard booking={booking} />
    </div>
  );
};

export default BookingDetailPage;
