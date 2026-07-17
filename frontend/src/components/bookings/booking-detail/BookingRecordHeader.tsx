// src/components/bookings/booking-detail/BookingRecordHeader.tsx
//
// The booking record strip: title, status badge, booked-on line, and the
// recorded-by (staff) attribution.
import React from "react";
import { Badge } from "@/components/ui/badge";
import { IBooking } from "@/types/booking.types";
import { formatDate, getStatusColor } from "./format";

export function BookingRecordHeader({ booking }: { booking: IBooking }) {
  return (
    <div className="overflow-hidden rounded-xl border border-foreground/15 bg-card">
      <div className="flex items-center justify-between gap-3 bg-night px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.2em] text-night-foreground sm:px-6">
        <span className="min-w-0 truncate">Travel Trek · Booking record</span>
        <span className="flex-none text-night-foreground/70">
          Nº {booking.id}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 p-4 sm:p-5">
        <h1 className="text-2xl font-semibold tracking-tight">
          {booking.type.charAt(0) + booking.type.slice(1).toLowerCase()}{" "}
          Booking
        </h1>
        <Badge variant="secondary" className={getStatusColor(booking.status)}>
          {booking.status}
        </Badge>
        <p className="w-full text-sm text-muted-foreground sm:w-auto">
          Booked on {formatDate(booking.bookingDate)}
        </p>
        {booking.createdBy && (
          <p className="w-full text-xs text-muted-foreground">
            Recorded by{" "}
            <span className="font-medium text-foreground/80 break-words [overflow-wrap:anywhere]">
              {booking.createdBy.name}
            </span>{" "}
            (staff)
          </p>
        )}
      </div>
    </div>
  );
}
