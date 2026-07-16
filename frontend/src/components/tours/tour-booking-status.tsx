// src/components/tours/tour-booking-status.tsx
//
// Customer-facing "Booking Status" section of the tour detail view: current
// booking badge with cancel action, or the book prompt.
"use client";
import { Bookmark, Loader2, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { BookingStatus } from "@/types/booking.types";
import type { ITour } from "@/types/tour.types";

interface ITourBookingStatusProps {
  tour: ITour;
  isBookingDataLoading: boolean;
  isTourBooked: boolean;
  isBookingActive: boolean;
  bookingStatus: BookingStatus | undefined;
  isFullyBooked: boolean;
  isBooking: boolean;
  isCancelling: boolean;
  bookingButtonText: string;
  bookingButtonDisabled: boolean;
  onBookingButtonClick: () => void;
}

export function TourBookingStatus({
  tour,
  isBookingDataLoading,
  isTourBooked,
  isBookingActive,
  bookingStatus,
  isFullyBooked,
  isBooking,
  isCancelling,
  bookingButtonText,
  bookingButtonDisabled,
  onBookingButtonClick }: ITourBookingStatusProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bookmark className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">
            Booking Status
          </h2>
        </div>
      </div>

      {isBookingDataLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : isTourBooked ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge
              variant={
                bookingStatus === "CONFIRMED"
                  ? "default"
                  : bookingStatus === "CANCELLED"
                  ? "destructive"
                  : bookingStatus === "COMPLETED"
                  ? "outline"
                  : "secondary"
              }
              className="text-sm"
            >
              {bookingStatus}
            </Badge>
          </div>
          {isBookingActive && (
            <Button
              variant="destructive"
              size="sm"
              onClick={onBookingButtonClick}
              disabled={isCancelling}
              className="cursor-pointer"
            >
              {isCancelling ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Cancel Booking
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-muted-foreground">
            {tour.status === "CANCELLED"
              ? "This tour has been cancelled."
              : tour.status === "COMPLETED"
              ? "This tour has been completed."
              : isFullyBooked
              ? "This tour is fully booked."
              : "You haven't booked this tour yet."}
          </p>
          {tour.status !== "CANCELLED" &&
            tour.status !== "COMPLETED" && (
              <Button
                variant="default"
                size="sm"
                onClick={onBookingButtonClick}
                disabled={bookingButtonDisabled}
                className="cursor-pointer"
              >
                {isBooking ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Bookmark className="mr-2 h-4 w-4" />
                )}
                {bookingButtonText}
              </Button>
            )}
        </div>
      )}
    </div>
  );
}
