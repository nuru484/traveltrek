// src/app/dashboard/tours/[id]/detail/page.tsx
"use client";
import { useParams } from "next/navigation";
import { useGetTourQuery } from "@/redux/tourApi";
import { TourDetail } from "@/components/tours/tour-detail";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import ErrorMessage from "@/components/ui/ErrorMessage";
import { TourDetailSkeleton } from "@/components/tours/tour-detail-skeleton";
import DetailPageHeader from "@/components/ui/DetailPageHeader";

export default function TourDetailPage() {
  const params = useParams<{ id: string }>();
  const tourId = parseInt(params.id, 10);

  const {
    data: tourData,
    error,
    isError,
    isLoading,
    refetch,
  } = useGetTourQuery(tourId);

  const tour = tourData?.data;
  const errorMessage = extractApiErrorMessage(error).message;


  if (isLoading) return <TourDetailSkeleton />;

  if (isError) return <ErrorMessage error={errorMessage} onRetry={refetch} />;

  if (!tour) {
    return <ErrorMessage error="Tour not found" onRetry={refetch} />;
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-10">
      <DetailPageHeader
        title="Tour Detail View"
        description="View Tour information details"
        backHref="/dashboard/tours"
        backLabel="Back to Tours"
      />

      <TourDetail tour={tour} />
    </div>
  );
}
