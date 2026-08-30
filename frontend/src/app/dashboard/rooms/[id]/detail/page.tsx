// src/app/dashboard/rooms/[id]/detail/page.tsx
"use client";
import { useGetRoomQuery } from "@/redux/roomApi";
import { RoomDetail } from "@/components/rooms/room-detail";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import ErrorMessage from "@/components/ui/ErrorMessage";
import { useParams } from "next/navigation";
import FormSkeleton from "@/components/ui/FormSkeleton";
import DetailPageHeader from "@/components/ui/DetailPageHeader";

export default function RoomDetailPage() {
  const params = useParams<{ id: string }>();
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


  if (isLoading)
    return (
      <div className="mx-auto w-full max-w-7xl">
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
    <div className="mx-auto w-full max-w-7xl">
      <div>
        <DetailPageHeader
          title="Room details"
          description="View room information and book your stay"
          backHref="/dashboard/hotels"
          backLabel="Back to hotels"
        />

        <div className="mt-6">
          <RoomDetail room={room} />
        </div>
      </div>
    </div>
  );
}
