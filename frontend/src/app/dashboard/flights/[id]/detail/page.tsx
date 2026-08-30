// src/app/dashboard/flights/[id]/detail/page.tsx
"use client";
import { useGetFlightQuery } from "@/redux/flightApi";
import { FlightDetail } from "@/components/flights/flight-detail";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import ErrorMessage from "@/components/ui/ErrorMessage";
import { useParams } from "next/navigation";
import { FlightDetailSkeleton } from "@/components/flights/flight-detail-skeleton";
import DetailPageHeader from "@/components/ui/DetailPageHeader";

export default function FlightDetailPage() {
  const params = useParams<{ id: string }>();
  const flightId = parseInt(params.id, 10);


  const {
    data: flightData,
    error,
    isError,
    isLoading,
    refetch,
  } = useGetFlightQuery(flightId);

  const hotel = flightData?.data;
  const errorMessage = extractApiErrorMessage(error).message;

  if (isLoading) return <FlightDetailSkeleton />;

  if (isError) return <ErrorMessage error={errorMessage} onRetry={refetch} />;

  if (!hotel) {
    return <ErrorMessage error="Flight not found" onRetry={refetch} />;
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-10">
      <DetailPageHeader
        title="Flight details"
        description="View Flight information details"
        backHref="/dashboard/flights"
        backLabel="Back to flights"
      />

      <FlightDetail flight={hotel} />
    </div>
  );
}
