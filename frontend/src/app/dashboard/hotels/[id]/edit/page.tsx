// src/app/dashboard/hotels/[id]/edit/page.tsx
"use client";
import { useGetHotelQuery } from "@/redux/hotelApi";
import { HotelForm } from "@/components/hotels/hotel-form";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import ErrorMessage from "@/components/ui/ErrorMessage";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Hotel } from "lucide-react";

export default function EditHotelPage() {
  const params = useParams<{ id: string }>();
  const hotelId = parseInt(params.id, 10);
  const router = useRouter();

  const {
    data: hotelData,
    error,
    isError,
    isLoading,
    refetch,
  } = useGetHotelQuery(hotelId);

  const hotel = hotelData?.data;
  const errorMessage = extractApiErrorMessage(error).message;

  const handleGoBack = () => {
    router.push("/dashboard/hotels");
  };

  if (isLoading)
    return (
      <div className="container mx-auto py-6">
        <Card className="">
          <CardHeader>
            <Skeleton className="h-8 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );

  if (isError) return <ErrorMessage error={errorMessage} onRetry={refetch} />;

  if (!hotel) {
    return <ErrorMessage error="Hotel not found" onRetry={refetch} />;
  }

  return (
    <div className="container mx-auto space-y-10">
      <div className="border-b border-border pb-4 sm:pb-6">
        {/* Mobile Layout - Stacked */}
        <div className="flex flex-col space-y-3 sm:hidden">
          <Button
            variant="outline"
            size="sm"
            onClick={handleGoBack}
            className="flex items-center gap-2 self-start"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground">Edit Hotel</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Edit Hotel Details
            </p>
          </div>
        </div>

        {/* Tablet and Desktop Layout - Side by side */}
        <div className="hidden sm:flex sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            {/* Hide icon on smaller screens, show on md+ */}
            <div className="hidden md:flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
              <Hotel className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Edit Hotel</h1>
              <p className="text-sm text-muted-foreground">
                Edit Hotel Details
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleGoBack}
            className="flex items-center gap-2 shrink-0 ml-4 hover:cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back to Hotels</span>
            <span className="sm:hidden">Back</span>
          </Button>
        </div>
      </div>

      <HotelForm mode="edit" hotel={hotel} />
    </div>
  );
}
