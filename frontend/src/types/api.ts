// src/types/api.ts
export const apiSliceTags = [
  "Customer",
  "Customers",
  "CustomerBookings",
  "CustomerPayments",
  "Flight",
  "Flights",
  "Destination",
  "Hotel",
  "Hotels",
  "Tour",
  "Tours",
  "Booking",
  "Bookings",
  "Payment",
  "Payments",
  "User",
  "Users",
  "TwoFactor",
  "Dashboard",
  "NeedsAttention",
  "Rooms",
  "Room",
  "ToursReport",
  "PaymentsReport",
  "BookingsReport",
  "MyReport",
  "AgentActivity",
  "Review",
  "Reviews",
  "MyReviews",
] as const;

/** Success envelope: { message, data, meta? } (lists put pagination in meta). */
export interface IApiResponse<T> {
  message: string;
  data: T;
  meta?: unknown;
}

export interface IPaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
