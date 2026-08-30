// src/app/dashboard/destinations/[id]/detail/page.tsx
"use client";
import { useGetDestinationQuery } from "@/redux/destinationApi";
import DestinationDetail from "@/components/destinations/DestinationDetail";
import { useParams } from "next/navigation";
import DetailedViewSkeleton from "@/components/DetailedViewSkeleton";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import ErrorMessage from "@/components/ui/ErrorMessage";
import DetailPageHeader from "@/components/ui/DetailPageHeader";

export default function DestinationDetailPage() {
  const params = useParams<{ id: string }>();
  const destinationId = parseInt(params.id, 10);


  const {
    data: destinationData,
    error,
    isError,
    isLoading,
    refetch,
  } = useGetDestinationQuery(destinationId);

  const destination = destinationData?.data;
  const errorMessage = extractApiErrorMessage(error).message;

  if (isLoading) {
    return <DetailedViewSkeleton />;
  }

  if (isError) return <ErrorMessage error={errorMessage} onRetry={refetch} />;

  if (!destination) {
    return <ErrorMessage error="Destination not found" onRetry={refetch} />;
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-10">
      <DetailPageHeader
        title="Destination details"
        description="View comprehensive Destination information details"
        backHref="/dashboard/destinations"
        backLabel="Back to destinations"
      />

      <DestinationDetail destination={destination} />
    </div>
  );
}
