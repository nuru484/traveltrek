// src/components/bookings/table/bookings-table-logic.ts
//
// Pure display helpers shared by the desktop columns and the mobile row
// cards, extracted so both halves render a booking identically.
import { IBooking } from "@/types/booking.types";

/** Human label for the booked service, matching the table's Service column. */
export function bookingServiceName(booking: IBooking): string {
  let serviceName = "";

  switch (booking.type) {
    case "TOUR":
      serviceName = booking.tour.name;
      break;
    case "ROOM":
      serviceName = `${booking.room?.roomType ?? ""} - ${
        booking?.room?.hotel?.name ?? ""
      }`;
      break;
    case "FLIGHT":
      serviceName = `${booking.flight.airline} ${booking.flight.flightNumber}`;
      break;
  }

  return serviceName;
}

export const getStatusVariant = (status: IBooking["status"]) => {
  switch (status) {
    case "CONFIRMED":
      return "default";
    case "COMPLETED":
      return "secondary";
    case "PENDING":
      return "outline";
    case "CANCELLED":
      return "destructive";
    default:
      return "outline";
  }
};

export const getPaymentStatusVariant = (
  paymentStatus: NonNullable<IBooking["payment"]>["status"] | undefined
) => {
  switch (paymentStatus) {
    case "COMPLETED":
      return "default";
    case "PENDING":
      return "outline";
    case "FAILED":
      return "destructive";
    case "REFUNDED":
      return "secondary";
    // Awaiting an admin refund after a customer cancelled a paid booking.
    case "REFUND_REQUESTED":
      return "destructive";
    default:
      return "outline";
  }
};
