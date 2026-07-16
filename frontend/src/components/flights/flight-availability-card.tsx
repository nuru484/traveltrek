// src/components/flights/flight-availability-card.tsx
//
// "Availability & Booking" card: seats-remaining summary plus the customer's
// full-width booking/cancel action for the flight's current state.
"use client";
import {
  Bookmark,
  Calendar,
  CheckCircle,
  Loader2,
  PlaneLanding,
  Users,
  XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { BookingStatus } from "@/types/booking.types";
import type { IFlight } from "@/types/flight.types";

interface IFlightAvailabilityCardProps {
  flight: IFlight;
  /** Customer-only actions render when neither admin nor agent. */
  isAdmin: boolean;
  isAgent: boolean;
  isAvailable: boolean;
  isBookingDataLoading: boolean;
  isFlightBooked: boolean;
  isBookingActive: boolean;
  bookingStatus: BookingStatus | undefined;
  isBooking: boolean;
  isCancelling: boolean;
  onBookingButtonClick: () => void;
}

export function FlightAvailabilityCard({
  flight,
  isAdmin,
  isAgent,
  isAvailable,
  isBookingDataLoading,
  isFlightBooked,
  isBookingActive,
  bookingStatus,
  isBooking,
  isCancelling,
  onBookingButtonClick }: IFlightAvailabilityCardProps) {
  return (
    <Card className="py-0">
      <CardContent className="p-4 sm:p-6">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
          <Users className="h-5 w-5" />
          Availability & Booking
        </h3>
        <div className="space-y-4">
          <div className="bg-muted/30 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-medium text-foreground">Seats Available</p>
                <p className="text-sm text-muted-foreground">
                  {flight.seatsAvailable > 0
                    ? `${flight.seatsAvailable} of ${flight.capacity} seats remaining`
                    : "Fully Booked"}
                </p>
              </div>
              <Badge
                variant={
                  flight.seatsAvailable === 0
                    ? "destructive"
                    : flight.seatsAvailable > 20
                    ? "default"
                    : flight.seatsAvailable > 5
                    ? "secondary"
                    : "destructive"
                }
              >
                {flight.seatsAvailable === 0
                  ? "Unavailable"
                  : flight.seatsAvailable > 20
                  ? "Available"
                  : flight.seatsAvailable > 5
                  ? "Limited"
                  : "Few Left"}
              </Badge>
            </div>

            {isBookingDataLoading ? (
              <div className="h-5 w-40 bg-muted animate-pulse rounded mt-2"></div>
            ) : (
              <p
                className={`text-sm flex items-center gap-2 ${
                  isAvailable &&
                  flight.status !== "CANCELLED" &&
                  flight.status !== "LANDED"
                    ? "text-green-600"
                    : "text-destructive"
                }`}
              >
                {flight.status === "CANCELLED" ? (
                  <>
                    <XCircle className="h-4 w-4" />
                    Flight cancelled
                  </>
                ) : flight.status === "LANDED" ? (
                  <>
                    <XCircle className="h-4 w-4" />
                    Flight has landed
                  </>
                ) : isAvailable ? (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    {isFlightBooked && isBookingActive
                      ? `Booking ${bookingStatus}`
                      : "Ready to book"}
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4" />
                    Fully booked
                  </>
                )}
              </p>
            )}
          </div>
          <div className="text-sm">
            <span className="text-muted-foreground">Capacity:</span>
            <p className="font-medium">{flight.capacity} seats</p>
          </div>

          {/* Action Button for Users (non-admin/agent) */}
          {!isAdmin && !isAgent && (
            <div className="pt-2">
              {isBookingDataLoading ? (
                <Button variant="secondary" className="w-full" size="lg" disabled>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Loading...
                </Button>
              ) : flight.status === "CANCELLED" ? (
                <Button disabled className="w-full" size="lg">
                  <XCircle className="h-4 w-4 mr-2" />
                  Flight Cancelled
                </Button>
              ) : flight.status === "LANDED" ? (
                <Button disabled className="w-full" size="lg">
                  <PlaneLanding className="h-4 w-4 mr-2" />
                  Flight Has Landed
                </Button>
              ) : !isAvailable && !isFlightBooked ? (
                <Button disabled className="w-full" size="lg">
                  <XCircle className="h-4 w-4 mr-2" />
                  Fully Booked
                </Button>
              ) : bookingStatus === "CANCELLED" ||
                bookingStatus === "COMPLETED" ? (
                <Button variant="secondary" className="w-full" size="lg" disabled>
                  <Bookmark className="h-4 w-4 mr-2" />
                  {bookingStatus === "CANCELLED" ? "Cancelled" : "Completed"}
                </Button>
              ) : isBookingActive ? (
                <Button
                  onClick={onBookingButtonClick}
                  variant="secondary"
                  className="w-full"
                  size="lg"
                  disabled={isCancelling}
                >
                  <Bookmark className="h-4 w-4 mr-2" />
                  {isCancelling
                    ? "Cancelling..."
                    : `Cancel Booking (${bookingStatus})`}
                </Button>
              ) : (
                <Button
                  onClick={onBookingButtonClick}
                  className="w-full"
                  size="lg"
                  disabled={isBooking || !isAvailable}
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  {isBooking ? "Booking..." : "Book This Flight"}
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
