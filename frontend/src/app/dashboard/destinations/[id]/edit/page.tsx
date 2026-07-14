// src/app/dashboard/destinations/[id]/edit/page.tsx
"use client";
import { useGetDestinationQuery } from "@/redux/destinationApi";
import DestinationForm from "@/components/destinations/DestinationForm";
import DestinationFormSkeleton from "@/components/destinations/DestinationFormSkeleton";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import ErrorMessage from "@/components/ui/ErrorMessage";
import { useParams } from "next/navigation";
import DetailPageHeader from "@/components/ui/DetailPageHeader";

export default function EditDestinationPage() {
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
    return <DestinationFormSkeleton />;
  }

  if (isError) return <ErrorMessage error={errorMessage} onRetry={refetch} />;

  if (!destination) {
    return <ErrorMessage error="Destination not found" onRetry={refetch} />;
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-10">
      <DetailPageHeader
        title="Edit Destination"
        description="Edit Destination information details"
        backHref="/dashboard/destinations"
        backLabel="Back to Destinations"
      />

      <DestinationForm mode="edit" destination={destination} />
    </div>
  );
}
