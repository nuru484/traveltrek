// src/app/dashboard/rooms/[id]/edit/page.tsx
"use client";
import { RoomForm } from "@/components/rooms/room-form";
import { useGetRoomQuery } from "@/redux/roomApi";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import ErrorMessage from "@/components/ui/ErrorMessage";
import { useParams } from "next/navigation";
import { RoomFormSkeleton } from "@/components/rooms/room-form-skeleton";
import DetailPageHeader from "@/components/ui/DetailPageHeader";

export default function EditRoomPage() {
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


  if (isLoading) return <RoomFormSkeleton />;

  if (isError) return <ErrorMessage error={errorMessage} onRetry={refetch} />;

  if (!room) {
    return <ErrorMessage error="Room not found" onRetry={refetch} />;
  }

  return (
    <div className="mx-auto w-full max-w-7xl py-6 space-y-6">
      <DetailPageHeader
        title="Edit Room"
        backHref={`/dashboard/rooms/${room.id}/detail`}
        backLabel="Back to Room"
      />

      <RoomForm mode="edit" room={room} />
    </div>
  );
}
