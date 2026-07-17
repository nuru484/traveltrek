// src/components/bookings/booking-detail/BookingSummaryCard.tsx
//
// Booking summary card: guest count, room-only nights/dates, special
// requests, the payment deadline row, and the total price.
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Calendar,
  Clock,
  DollarSign,
  Hotel,
  MessageSquare,
  Moon,
  Users,
} from "lucide-react";
import { IBooking } from "@/types/booking.types";
import { formatMoney } from "@/utils/format-money";
import { formatDate, formatDateOnly } from "./format";

export function BookingSummaryCard({
  booking,
  deadlinePassed,
}: {
  booking: IBooking;
  deadlinePassed: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          Booking Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">
                Number of Guests
              </span>
            </div>
            <span className="text-sm font-semibold">
              {booking.numberOfGuests}{" "}
              {booking.numberOfGuests === 1 ? "Guest" : "Guests"}
            </span>
          </div>

          {/* Room-specific details */}
          {booking.type === "ROOM" && booking.room && (
            <>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Hotel className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">
                    Number of Rooms
                  </span>
                </div>
                <span className="text-sm font-semibold">
                  {booking.room.numberOfRooms}{" "}
                  {booking.room.numberOfRooms === 1 ? "Room" : "Rooms"}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Moon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">
                    Number of Nights
                  </span>
                </div>
                <span className="text-sm font-semibold">
                  {booking.room.numberOfNights}{" "}
                  {booking.room.numberOfNights === 1 ? "Night" : "Nights"}
                </span>
              </div>

              <Separator />

              <div>
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-2 mb-2">
                  <Calendar className="h-4 w-4" />
                  Check-in Date
                </label>
                <p className="text-sm font-medium ml-6">
                  {formatDateOnly(booking.room.startDate)}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-2 mb-2">
                  <Calendar className="h-4 w-4" />
                  Check-out Date
                </label>
                <p className="text-sm font-medium ml-6">
                  {formatDateOnly(booking.room.endDate)}
                </p>
              </div>
            </>
          )}

          {/* Special Requests */}
          {booking.specialRequests && (
            <>
              <Separator />
              <div>
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-2 mb-2">
                  <MessageSquare className="h-4 w-4" />
                  Special Requests
                </label>
                <p className="text-sm bg-muted/50 p-3 rounded-md border break-all">
                  {booking.specialRequests}
                </p>
              </div>
            </>
          )}

          {/* Payment Deadline */}
          {booking.paymentDeadline && (
            <>
              <Separator />
              <div>
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4" />
                  Payment Deadline
                </label>
                <p
                  className={`text-sm font-medium ml-6 ${
                    deadlinePassed ? "text-red-600" : ""
                  }`}
                >
                  {formatDate(booking.paymentDeadline)}
                  {deadlinePassed && (
                    <span className="ml-2 text-xs">(Overdue)</span>
                  )}
                </p>
              </div>
            </>
          )}
        </div>

        <Separator />

        <div className="flex items-center justify-between pt-2">
          <span className="text-sm font-medium text-muted-foreground">
            Total Price
          </span>
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            <span className="text-xl font-bold text-green-600">
              {formatMoney(booking.totalPrice, { exact: true })}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
