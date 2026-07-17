// components/BookingDetailView.tsx
//
// Thin composer for the booking detail page. Each section lives in its own
// module under ./booking-detail: the record header, the pending-payment
// deadline alert, the customer and summary cards, the booked-item card
// (tour/room/flight bodies), the payment card, and the admin-only timeline.
// Pure presentation helpers (badge colours, date formatting, the deadline
// check) live in ./booking-detail/format.
import React from "react";
import { IBooking } from "@/types/booking.types";
import { BookingRecordHeader } from "./booking-detail/BookingRecordHeader";
import { PaymentDeadlineAlert } from "./booking-detail/PaymentDeadlineAlert";
import { CustomerInfoCard } from "./booking-detail/CustomerInfoCard";
import { BookingSummaryCard } from "./booking-detail/BookingSummaryCard";
import { BookingItemCard } from "./booking-detail/BookingItemCard";
import { PaymentInfoCard } from "./booking-detail/PaymentInfoCard";
import { BookingTimelineCard } from "./booking-detail/BookingTimelineCard";
import { isPaymentDeadlinePassed } from "./booking-detail/format";

interface BookingDetailViewProps {
  booking: IBooking;
  userRole?: "ADMIN" | "USER" | "MANAGER";
}

const BookingDetailView: React.FC<BookingDetailViewProps> = ({
  booking,
  userRole = "USER" }) => {
  const isAdmin = userRole === "ADMIN" || userRole === "MANAGER";
  const deadlinePassed = booking.paymentDeadline
    ? isPaymentDeadlinePassed(booking.paymentDeadline)
    : false;

  return (
    <div className="space-y-6">
      {/* Header — booking record strip */}
      <BookingRecordHeader booking={booking} />

      {/* Payment Deadline Alert */}
      {booking.paymentDeadline && booking.status === "PENDING" && (
        <PaymentDeadlineAlert
          deadline={booking.paymentDeadline}
          deadlinePassed={deadlinePassed}
        />
      )}

      <div className="grid items-start gap-6 @4xl/main:grid-cols-2">
        {/* Customer Information */}
        <CustomerInfoCard booking={booking} />

        {/* Booking Summary */}
        <BookingSummaryCard booking={booking} deadlinePassed={deadlinePassed} />
      </div>

      {/* Booking Details */}
      <BookingItemCard booking={booking} />

      {/* Payment Information */}
      {booking.payment && <PaymentInfoCard payment={booking.payment} />}

      {/* Timestamps - Only for Admin */}
      {isAdmin && <BookingTimelineCard booking={booking} />}
    </div>
  );
};

export default BookingDetailView;
