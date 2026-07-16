// src/components/tours/tour-detail-logic.ts
//
// Pure helpers behind the tour detail view: status transitions/metadata,
// display formatting and the booking-button text/disabled rules. Kept free of
// React so they can be unit-tested directly.
import { format } from "date-fns";
import {
  AlertCircle,
  CheckCircle,
  Clock,
  PlayCircle,
  XCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { BookingStatus } from "@/types/booking.types";
import type { IDestinationSummary, TourStatus } from "@/types/tour.types";

export const getAvailableStatusTransitions = (currentStatus: string) => {
  const transitions: Record<string, string[]> = {
    UPCOMING: ["ONGOING", "CANCELLED"],
    ONGOING: ["COMPLETED"],
    COMPLETED: [],
    CANCELLED: ["UPCOMING"] };

  return transitions[currentStatus] || [];
};

export interface ITourStatusConfig {
  variant: "default" | "secondary" | "outline" | "destructive";
  icon: LucideIcon;
  label: string;
}

export const getTourStatusConfig = (status: string): ITourStatusConfig => {
  switch (status) {
    case "UPCOMING":
      return {
        variant: "default",
        icon: Clock,
        label: "Upcoming" };
    case "ONGOING":
      return {
        variant: "secondary",
        icon: PlayCircle,
        label: "Ongoing" };
    case "COMPLETED":
      return {
        variant: "outline",
        icon: CheckCircle,
        label: "Completed" };
    case "CANCELLED":
      return {
        variant: "destructive",
        icon: XCircle,
        label: "Cancelled" };
    default:
      return {
        variant: "secondary",
        icon: AlertCircle,
        label: status };
  }
};

/** "3 days" / "1 day". */
export const formatTourDuration = (days: number): string =>
  `${days} day${days > 1 ? "s" : ""}`;

/** Compact timestamp used in the info tiles. */
export const formatTourDate = (date: string | Date): string =>
  format(new Date(date), "MMM dd, yyyy · h:mm a");

/** Long-form timestamp used in the metadata footer. */
export const formatTourDateLong = (date: string | Date): string =>
  format(new Date(date), "EEEE, MMMM dd, yyyy 'at' h:mm a");

/** "Name, City, Country" — city omitted when the destination has none. */
export const getDestinationDisplay = (
  destination: IDestinationSummary | null | undefined
): string => {
  if (!destination) return "Unknown Destination";
  const { name, city, country } = destination;
  if (city) {
    return `${name}, ${city}, ${country}`;
  }
  return `${name}, ${country}`;
};

export interface ITourBookingButtonFlags {
  isBookingDataLoading: boolean;
  isTourBooked: boolean;
  isFullyBooked: boolean;
  bookingStatus: BookingStatus | undefined;
}

export const getBookingButtonText = ({
  isBookingDataLoading,
  isTourBooked,
  isFullyBooked,
  bookingStatus }: ITourBookingButtonFlags): string => {
  if (isBookingDataLoading) {
    return "Loading...";
  }

  if (!isTourBooked) {
    return isFullyBooked ? "Fully Booked" : "Book Now";
  }

  switch (bookingStatus) {
    case "PENDING":
      return "Booked";
    case "CONFIRMED":
      return "Confirmed";
    case "CANCELLED":
      return "Cancelled";
    case "COMPLETED":
      return "Completed";
    default:
      return "Booked";
  }
};

export const isBookingButtonDisabled = ({
  isBookingDataLoading,
  isTourBooked,
  isFullyBooked,
  bookingStatus,
  isBooking,
  isCancelling,
  tourStatus }: ITourBookingButtonFlags & {
  isBooking: boolean;
  isCancelling: boolean;
  tourStatus: TourStatus;
}): boolean => {
  return (
    isBookingDataLoading ||
    isBooking ||
    isCancelling ||
    (isFullyBooked && !isTourBooked) ||
    bookingStatus === "CANCELLED" ||
    bookingStatus === "COMPLETED" ||
    tourStatus === "CANCELLED" ||
    tourStatus === "COMPLETED"
  );
};
