// components/BookingDetailView.tsx
import React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Calendar,
  DollarSign,
  User,
  Mail,
  ExternalLink,
  MapPin,
  Plane,
  Building2,
  Bed,
  ArrowRight,
} from "lucide-react";
import { IBooking } from "@/types/booking.types";

interface BookingDetailViewProps {
  booking: IBooking;
  userRole?: "ADMIN" | "USER" | "MANAGER";
}

const getStatusColor = (status: string) => {
  switch (status) {
    case "PENDING":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "CONFIRMED":
      return "bg-green-100 text-green-800 border-green-200";
    case "CANCELLED":
      return "bg-red-100 text-red-800 border-red-200";
    case "COMPLETED":
      return "bg-blue-100 text-blue-800 border-blue-200";
    default:
      return "bg-muted text-muted-foreground";
  }
};

const getPaymentStatusColor = (status: string) => {
  switch (status) {
    case "PENDING":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "COMPLETED":
      return "bg-green-100 text-green-800 border-green-200";
    case "FAILED":
      return "bg-red-100 text-red-800 border-red-200";
    case "REFUNDED":
      return "bg-orange-100 text-orange-800 border-orange-200";
    default:
      return "bg-muted text-muted-foreground";
  }
};

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

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
};

const formatDate = (dateString: string) => {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateString));
};

const BookingDetailView: React.FC<BookingDetailViewProps> = ({
  booking,
  userRole = "USER",
}) => {
  const isAdmin = userRole === "ADMIN" || userRole === "MANAGER";

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {getBookingTypeIcon(booking.type)}
              <div>
                <CardTitle className="text-2xl font-semibold">
                  {booking.type.charAt(0) + booking.type.slice(1).toLowerCase()}{" "}
                  Booking
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Booked on {formatDate(booking.bookingDate)}
                </p>
              </div>
            </div>
            <Badge
              variant="secondary"
              className={getStatusColor(booking.status)}
            >
              {booking.status}
            </Badge>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Customer Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Customer Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Name
                </label>
                <p className="text-sm font-medium">{booking.user.name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Email
                </label>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm">{booking.user.email}</p>
                </div>
              </div>
            </div>
            <Separator />
            <Link
              href={`/dashboard/users/${booking.userId}/user-profile`}
              className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors font-medium"
            >
              View Customer Profile
              <ExternalLink className="h-3 w-3" />
            </Link>
          </CardContent>
        </Card>

        {/* Booking Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {getBookingTypeIcon(booking.type)}
              Booking Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Tour Booking */}
            {/* Tour Booking */}
            {booking.type === "TOUR" && booking.tour && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">
                    Tour
                  </label>
                  <div>
                    <p className="font-semibold text-base">
                      {booking.tour.name}
                    </p>
                    {booking.tour.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {booking.tour.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">
                    Destination
                  </label>
                  {booking.tour.destination ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm font-medium">
                          {booking.tour.destination.name}
                        </p>
                      </div>
                      <p className="text-sm text-muted-foreground ml-6">
                        {booking.tour.destination.city &&
                          `${booking.tour.destination.city}, `}
                        {booking.tour.destination.country}
                      </p>
                      <Link
                        href={`/dashboard/destinations/${booking.tour.destination.id}/detail`}
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
                  href={`/dashboard/tours/${booking.tour.id}/detail`}
                  className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors font-medium"
                >
                  View Tour Details
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            )}

            {/* Room Booking */}
            {booking.type === "ROOM" && booking.room && (
              <div className="space-y-3">
                {booking.room.hotel && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">
                      Hotel
                    </label>
                    <div>
                      <p className="font-semibold text-base">
                        {booking.room.hotel.name}
                      </p>
                      {booking.room.hotel.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {booking.room.hotel.description}
                        </p>
                      )}
                      {booking.room.hotel.destination && (
                        <div className="space-y-2 mt-2">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <p className="text-sm font-medium">
                              {booking.room.hotel.destination.name}
                            </p>
                          </div>
                          <p className="text-sm text-muted-foreground ml-6">
                            {booking.room.hotel.destination.city &&
                              `${booking.room.hotel.destination.city}, `}
                            {booking.room.hotel.destination.country}
                          </p>
                          <Link
                            href={`/dashboard/destinations/${booking.room.hotel.destination.id}/detail`}
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
                      <p className="font-medium">{booking.room.roomType}</p>
                      {booking.room.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {booking.room.description}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <Separator />

                <Link
                  href={`/dashboard/rooms/${booking.room.id}/detail`}
                  className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors font-medium"
                >
                  View Room Details
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            )}

            {/* Flight Booking */}
            {booking.type === "FLIGHT" && booking.flight && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">
                    Flight
                  </label>
                  <div className="flex items-center gap-2">
                    <Plane className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-semibold text-base">
                        {booking.flight.airline}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Flight {booking.flight.flightNumber}
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
                      <p className="font-semibold">
                        {booking.flight.origin.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {booking.flight.origin.city &&
                          `${booking.flight.origin.city}, `}
                        {booking.flight.origin.country}
                      </p>
                    </div>

                    <div className="pt-6">
                      <ArrowRight className="h-5 w-5 text-muted-foreground" />
                    </div>

                    <div className="flex-1 space-y-1">
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Destination
                      </label>
                      <p className="font-semibold">
                        {booking.flight.destination.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {booking.flight.destination.city &&
                          `${booking.flight.destination.city}, `}
                        {booking.flight.destination.country}
                      </p>
                    </div>
                  </div>
                </div>

                <Separator />

                <Link
                  href={`/dashboard/flights/${booking.flight.id}/detail`}
                  className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors font-medium"
                >
                  View Flight Details
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            )}

            <Separator />

            <div className="flex items-center justify-between pt-2">
              <span className="text-sm font-medium text-muted-foreground">
                Total Price
              </span>
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-green-600" />
                <span className="text-xl font-bold text-green-600">
                  {formatCurrency(booking.totalPrice)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment Information */}
      {booking.payment && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Payment Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Amount
                </label>
                <p className="text-lg font-semibold">
                  {formatCurrency(booking.payment.amount)}
                </p>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Status
                </label>
                <Badge
                  variant="secondary"
                  className={getPaymentStatusColor(booking.payment.status)}
                >
                  {booking.payment.status}
                </Badge>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Method
                </label>
                <p className="text-sm font-medium">
                  {booking.payment.paymentMethod.replace("_", " ")}
                </p>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Payment ID
                </label>
                <p className="text-sm text-muted-foreground font-mono">
                  #{booking.payment.id}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Timestamps - Only for Admin */}
      {isAdmin && (
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
      )}
    </div>
  );
};

export default BookingDetailView;
