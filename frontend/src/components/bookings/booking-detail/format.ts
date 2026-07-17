// src/components/bookings/booking-detail/format.ts
//
// Pure presentation helpers for the booking detail view: the status/payment
// badge colour maps, the two date formatters, and the payment-deadline check.
// Kept dependency-free so they can be unit-tested in isolation.

export const getStatusColor = (status: string) => {
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

export const getPaymentStatusColor = (status: string) => {
  switch (status) {
    case "PENDING":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "COMPLETED":
      return "bg-green-100 text-green-800 border-green-200";
    case "FAILED":
      return "bg-red-100 text-red-800 border-red-200";
    case "REFUNDED":
      return "bg-orange-100 text-orange-800 border-orange-200";
    case "REFUND_REQUESTED":
      return "bg-purple-100 text-purple-800 border-purple-200";
    default:
      return "bg-muted text-muted-foreground";
  }
};

export const formatDate = (dateString: string) => {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit" }).format(new Date(dateString));
};

export const formatDateOnly = (dateString: string) => {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric" }).format(new Date(dateString));
};

export const isPaymentDeadlinePassed = (deadline: string) => {
  return new Date(deadline) < new Date();
};
