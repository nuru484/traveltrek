// src/app/dashboard/rooms/create/page.tsx
"use client";
import { RoomForm } from "@/components/rooms/room-form";
import { useParams } from "next/navigation";
import DetailPageHeader from "@/components/ui/DetailPageHeader";

export default function CreateRoomPage() {
  const params = useParams<{ id: string }>();
  const hotelId = parseInt(params.id, 10);


  return (
    <div className="mx-auto w-full max-w-7xl py-6 space-y-6">
      <DetailPageHeader
        title="Add room"
        description="Add a new room to this hotel"
        backHref={`/dashboard/hotels/${hotelId}/detail`}
        backLabel="Back to the hotel"
      />

      <RoomForm mode="create" hotelId={hotelId} />
    </div>
  );
}
