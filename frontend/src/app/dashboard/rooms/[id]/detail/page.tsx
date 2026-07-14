// src/app/dashboard/rooms/[id]/detail/page.tsx
"use client";
import { useGetRoomQuery } from "@/redux/roomApi";
import { RoomDetail } from "@/components/rooms/room-detail";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import ErrorMessage from "@/components/ui/ErrorMessage";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Bed } from "lucide-react";
import FormSkeleton from "@/components/ui/FormSkeleton";

export default function RoomDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const roomId = parseInt(params.id, 10);

  const {
    data: roomData,
    error,
    isError,
    isLoading,
    refetch,
  } = useGetRoomQuery(roomId);

  const room = roomData?.data;
  const errorMessage = extractApiErrorMessage(error).message;

  const handleGoBack = () => {
    router.push("/dashboard/hotels");
  };

  if (isLoading)
    return (
      <div className="container mx-auto">
        <Card className="">
          <CardHeader>
            <Skeleton className="h-8 w-48" />
          </CardHeader>
          <CardContent className="space-y-4">
            <FormSkeleton />
            <div className="grid gap-4 md:grid-cols-2">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    );

  if (isError) return <ErrorMessage error={errorMessage} onRetry={refetch} />;

  if (!room) {
    return <ErrorMessage error="Room not found" onRetry={refetch} />;
  }

  return (
    <div className="container mx-auto">
      <div>
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
              <h1 className="text-xl font-bold text-foreground">
                Room Detail View
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                View room information and book your stay
              </p>
            </div>
          </div>

          {/* Tablet and Desktop Layout - Side by side */}
          <div className="hidden sm:flex sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              {/* Hide icon on smaller screens, show on md+ */}
              <div className="hidden md:flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                <Bed className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl lg:text-2xl font-bold text-foreground">
                  Room Detail View
                </h1>
                <p className="text-sm text-muted-foreground">
                  View comprehensive room details and make your reservation
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

        <div className="mt-6">
          <RoomDetail room={room} />
        </div>
      </div>
    </div>
  );
}
