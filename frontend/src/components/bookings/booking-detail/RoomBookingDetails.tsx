// src/components/bookings/booking-detail/RoomBookingDetails.tsx
//
// The ROOM variant of the booking details card body: hotel and its
// destination, the room type, and a link through to the room.
import React from "react";
import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import { Bed, ExternalLink, MapPin } from "lucide-react";
import { IBooking } from "@/types/booking.types";

export function RoomBookingDetails({
  room,
}: {
  room: NonNullable<IBooking["room"]>;
}) {
  return (
    <div className="space-y-3">
      {room.hotel && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">
            Hotel
          </label>
          <div>
            <p className="font-semibold text-base">{room.hotel.name}</p>
            {room.hotel.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2 break-all">
                {room.hotel.description}
              </p>
            )}
            {room.hotel.destination && (
              <div className="space-y-2 mt-2">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground break-all" />
                  <p className="text-sm font-medium">
                    {room.hotel.destination.name}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground ml-6">
                  {room.hotel.destination.city &&
                    `${room.hotel.destination.city}, `}
                  {room.hotel.destination.country}
                </p>
                <Link
                  href={`/dashboard/destinations/${room.hotel.destination.id}/detail`}
                  className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80 hover:underline transition-colors ml-6"
                >
                  View Destination Details
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      <Separator />

      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">
          Room Type
        </label>
        <div className="flex items-center gap-2">
          <Bed className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="font-medium">{room.roomType}</p>
            {room.description && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {room.description}
              </p>
            )}
          </div>
        </div>
      </div>

      <Separator />

      <Link
        href={`/dashboard/rooms/${room.id}/detail`}
        className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors font-medium"
      >
        View Room Details
        <ExternalLink className="h-3 w-3" />
      </Link>
    </div>
  );
}
