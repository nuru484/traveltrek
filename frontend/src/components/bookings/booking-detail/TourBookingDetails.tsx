// src/components/bookings/booking-detail/TourBookingDetails.tsx
//
// The TOUR variant of the booking details card body: tour name/description,
// destination, and a link through to the tour.
import React from "react";
import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import { ExternalLink, MapPin } from "lucide-react";
import { IBooking } from "@/types/booking.types";

export function TourBookingDetails({
  tour,
}: {
  tour: NonNullable<IBooking["tour"]>;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">
          Tour
        </label>
        <div>
          <p className="font-semibold text-base">{tour.name}</p>
          {tour.description && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2 break-all">
              {tour.description}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">
          Destination
        </label>
        {tour.destination ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">{tour.destination.name}</p>
            </div>
            <p className="text-sm text-muted-foreground ml-6">
              {tour.destination.city && `${tour.destination.city}, `}
              {tour.destination.country}
            </p>
            <Link
              href={`/dashboard/destinations/${tour.destination.id}/detail`}
              className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80 hover:underline transition-colors ml-6"
            >
              View Destination Details
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium text-muted-foreground">
              Unknown Destination
            </p>
          </div>
        )}
      </div>

      <Separator />

      <Link
        href={`/dashboard/tours/${tour.id}/detail`}
        className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors font-medium"
      >
        View Tour Details
        <ExternalLink className="h-3 w-3" />
      </Link>
    </div>
  );
}
