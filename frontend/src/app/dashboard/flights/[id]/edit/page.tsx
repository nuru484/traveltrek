// src/app/dashboard/flights/[id]/edit/page.tsx
"use client";

import { useGetFlightQuery } from "@/redux/flightApi";
import { FlightForm } from "@/components/flights/flight-form";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import ErrorMessage from "@/components/ui/ErrorMessage";
import { useParams } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import FormSkeleton from "@/components/ui/FormSkeleton";
import DetailPageHeader from "@/components/ui/DetailPageHeader";

export default function EditFlightPage() {
  const params = useParams<{ id: string }>();
  const flightId = parseInt(params.id, 10);

  const {
    data: flightData,
    error,
    isError,
    isLoading,
    refetch,
  } = useGetFlightQuery(flightId);

  const flight = flightData?.data;
  const errorMessage = extractApiErrorMessage(error).message;

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-7xl py-6 space-y-10">
        <div className="border-b border-border pb-4 sm:pb-6">
          <div className="mx-auto w-full max-w-7xl space-y-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <FormSkeleton />
      </div>
    );
  }

  if (isError) {
    return <ErrorMessage error={errorMessage} onRetry={refetch} />;
  }

  if (!flight) {
    return <ErrorMessage error="Flight not found" onRetry={refetch} />;
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-10">
      <DetailPageHeader
        title="Edit Flight"
        description="Modify existing flight details"
        backHref="/dashboard/flights"
        backLabel="Back to Flights"
      />

      <FlightForm mode="edit" flight={flight} />
    </div>
  );
}
