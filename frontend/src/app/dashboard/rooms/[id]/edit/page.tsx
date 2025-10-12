// src/app/dashboard/rooms/[id]/edit/page.tsx
"use client";
import { RoomForm } from "@/components/rooms/room-form";
import { useGetRoomQuery } from "@/redux/roomApi";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import ErrorMessage from "@/components/ui/ErrorMessage";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Edit3 } from "lucide-react";
import { RoomFormSkeleton } from "@/components/rooms/room-form-skeleton";

export default function EditRoomPage() {
  const params = useParams<{ id: string }>();
  const roomId = parseInt(params.id, 10);
  const router = useRouter();

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
    router.push(`/dashboard/rooms/${room.id}/detail`);
  };

  if (isLoading) return <RoomFormSkeleton />;

  if (isError) return <ErrorMessage error={errorMessage} onRetry={refetch} />;

  if (!room) {
    return <ErrorMessage error="Room not found" onRetry={refetch} />;
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="border-b border-border pb-4 sm:pb-6">
        {/* Mobile Layout */}
        <div className="flex flex-col space-y-3 sm:hidden">
          <Button
            variant="outline"
            size="sm"
            onClick={handleGoBack}
            className="flex items-center gap-2 self-start"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Room
          </Button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-bold text-foreground">Edit Room</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              {room.roomType} • {room.hotel?.name}
            </p>
          </div>
        </div>

        {/* Desktop Layout */}
        <div className="hidden sm:flex sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
              <Edit3 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold text-foreground">
                  Edit Room
                </h1>
              </div>
              <p className="text-sm text-muted-foreground">
                {room.roomType} • {room.hotel?.name}
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
            Back to Room
          </Button>
        </div>
      </div>

      <RoomForm mode="edit" room={room} />
    </div>
  );
}
