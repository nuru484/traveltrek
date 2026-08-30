// src/app/dashboard/hotels/[id]/detail/page.tsx
"use client";
import { useGetHotelQuery } from "@/redux/hotelApi";
import { HotelDetail } from "@/components/hotels/hotel-detail";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import ErrorMessage from "@/components/ui/ErrorMessage";
import { useParams } from "next/navigation";
import { HotelDetailSkeleton } from "@/components/hotels/hotel-detail-skeleton";
import DetailPageHeader from "@/components/ui/DetailPageHeader";

export default function HotelDetailPage() {
  const params = useParams<{ id: string }>();
  const hotelId = parseInt(params.id, 10);

  const {
    data: hotelData,
    error,
    isError,
    isLoading,
    refetch,
  } = useGetHotelQuery(hotelId);

  const hotel = hotelData?.data;
  const errorMessage = extractApiErrorMessage(error).message;


  if (isLoading) return <HotelDetailSkeleton />;

  if (isError) return <ErrorMessage error={errorMessage} onRetry={refetch} />;

  if (!hotel) {
    return <ErrorMessage error="Hotel not found" onRetry={refetch} />;
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-10">
      <DetailPageHeader
        title="Hotel details"
        description="View Hotel information details"
        backHref="/dashboard/hotels"
        backLabel="Back to hotels"
      />

      <HotelDetail hotel={hotel} />
    </div>
  );
}
