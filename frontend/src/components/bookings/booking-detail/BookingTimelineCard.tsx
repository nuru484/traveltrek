// src/components/bookings/booking-detail/BookingTimelineCard.tsx
//
// Admin-only booking timeline: booking date, created, and last-updated.
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "lucide-react";
import { IBooking } from "@/types/booking.types";
import { formatDate } from "./format";

export function BookingTimelineCard({ booking }: { booking: IBooking }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          Booking Timeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Booking Date
            </label>
            <p className="text-sm">{formatDate(booking.bookingDate)}</p>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Created
            </label>
            <p className="text-sm">{formatDate(booking.createdAt)}</p>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Last Updated
            </label>
            <p className="text-sm">{formatDate(booking.updatedAt)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
