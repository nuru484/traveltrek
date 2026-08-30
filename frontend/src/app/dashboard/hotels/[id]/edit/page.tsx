// src/app/dashboard/hotels/[id]/edit/page.tsx
"use client";
import { useGetHotelQuery } from "@/redux/hotelApi";
import { HotelForm } from "@/components/hotels/hotel-form";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import ErrorMessage from "@/components/ui/ErrorMessage";
import { useParams } from "next/navigation";
import FormSkeleton from "@/components/ui/FormSkeleton";
import DetailPageHeader from "@/components/ui/DetailPageHeader";

export default function EditHotelPage() {
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


  if (isLoading)
    return (
      <div className="mx-auto w-full max-w-7xl py-6">
        <Card className="">
          <CardHeader>
            <Skeleton className="h-8 w-48" />
          </CardHeader>
          <CardContent>
            <FormSkeleton />
          </CardContent>
        </Card>
      </div>
    );

  if (isError) return <ErrorMessage error={errorMessage} onRetry={refetch} />;

  if (!hotel) {
    return <ErrorMessage error="Hotel not found" onRetry={refetch} />;
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-10">
      <DetailPageHeader
        title="Edit hotel"
        description="Edit Hotel Details"
        backHref="/dashboard/hotels"
        backLabel="Back to hotels"
      />

      <HotelForm mode="edit" hotel={hotel} />
    </div>
  );
}
