// src/app/dashboard/rooms/create/page.tsx
"use client";
import { RoomForm } from "@/components/rooms/room-form";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, PlusCircle } from "lucide-react";

export default function CreateRoomPage() {
  const params = useParams<{ id: string }>();
  const hotelId = parseInt(params.id, 10);
  const router = useRouter();

  const handleGoBack = () => {
    router.push(`/dashboard/hotels/${hotelId}/detail`);
  };

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
            Back to Hotel
          </Button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-bold text-foreground">Create Room</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Add a new room to this hotel
            </p>
          </div>
        </div>

        {/* Desktop Layout */}
        <div className="hidden sm:flex sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
              <PlusCircle className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold text-foreground">
                  Create Room
                </h1>
              </div>
              <p className="text-sm text-muted-foreground">
                Add a new room to this hotel
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
            Back to Hotel
          </Button>
        </div>
      </div>

      <RoomForm mode="create" hotelId={hotelId} />
    </div>
  );
}
