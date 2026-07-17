// src/components/bookings/booking-detail/FlightBookingDetails.tsx
//
// The FLIGHT variant of the booking details card body: airline/flight number
// and the origin -> destination route, with a link through to the flight.
import React from "react";
import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import { ArrowRight, ExternalLink, Plane } from "lucide-react";
import { IBooking } from "@/types/booking.types";

export function FlightBookingDetails({
  flight,
}: {
  flight: NonNullable<IBooking["flight"]>;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">
          Flight
        </label>
        <div className="flex items-center gap-2">
          <Plane className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="font-semibold text-base">{flight.airline}</p>
            <p className="text-sm text-muted-foreground">
              Flight {flight.flightNumber}
            </p>
          </div>
        </div>
      </div>

      <Separator />

      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <div className="flex-1 space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Origin
            </label>
            <p className="font-semibold">{flight.origin.name}</p>
            <p className="text-sm text-muted-foreground">
              {flight.origin.city && `${flight.origin.city}, `}
              {flight.origin.country}
            </p>
          </div>

          <div className="pt-6">
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </div>

          <div className="flex-1 space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Destination
            </label>
            <p className="font-semibold">{flight.destination.name}</p>
            <p className="text-sm text-muted-foreground">
              {flight.destination.city && `${flight.destination.city}, `}
              {flight.destination.country}
            </p>
          </div>
        </div>
      </div>

      <Separator />

      <Link
        href={`/dashboard/flights/${flight.id}/detail`}
        className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors font-medium"
      >
        View Flight Details
        <ExternalLink className="h-3 w-3" />
      </Link>
    </div>
  );
}
