// src/components/bookings/booking-detail/BookingItemCard.tsx
//
// The booked-item details card: a type-aware header icon/title, then the
// tour / room / flight body for whichever item this booking is for.
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Calendar, MapPin, Plane } from "lucide-react";
import { IBooking } from "@/types/booking.types";
import { TourBookingDetails } from "./TourBookingDetails";
import { RoomBookingDetails } from "./RoomBookingDetails";
import { FlightBookingDetails } from "./FlightBookingDetails";

const getBookingTypeIcon = (type: string) => {
  switch (type) {
    case "TOUR":
      return <MapPin className="h-5 w-5 text-primary" />;
    case "FLIGHT":
      return <Plane className="h-5 w-5 text-primary" />;
    case "ROOM":
      return <Building2 className="h-5 w-5 text-primary" />;
    default:
      return <Calendar className="h-5 w-5 text-primary" />;
  }
};

export function BookingItemCard({ booking }: { booking: IBooking }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {getBookingTypeIcon(booking.type)}
          {booking.type === "TOUR" && "Tour Details"}
          {booking.type === "ROOM" && "Room Details"}
          {booking.type === "FLIGHT" && "Flight Details"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {booking.type === "TOUR" && booking.tour && (
          <TourBookingDetails tour={booking.tour} />
        )}
        {booking.type === "ROOM" && booking.room && (
          <RoomBookingDetails room={booking.room} />
        )}
        {booking.type === "FLIGHT" && booking.flight && (
          <FlightBookingDetails flight={booking.flight} />
        )}
      </CardContent>
    </Card>
  );
}
