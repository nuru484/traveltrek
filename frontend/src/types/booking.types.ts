import { IDestinationSummary } from "./flight.types";
export interface IBookingUser {
  id: number;
  name: string;
  email: string;
}

export interface IBookingTour {
  id: number;
  name: string;
  description: string | null;
  destination: IDestinationSummary;
}

export interface IBookingRoom {
  id: number;
  roomType: string;
  description: string | null;
  numberOfRooms: number;
  numberOfNights: number;
  startDate: string;
  endDate: string;
  hotel: {
    id: number;
    name: string;
    description: string | null;
    destination: {
      id: number;
      city: string;
      country: string;
      name: string;
    };
  };
}

export interface IBookingFlight {
  id: number;
  flightNumber: string;
  airline: string;
  origin: {
    id: number;
    name: string;
    city: string | null;
    country: string;
  };
  destination: {
    id: number;
    name: string;
    city: string | null;
    country: string;
  };
}

export type BookingStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED";

export interface IBookingPayment {
  id: number;
  amount: number;
  status: "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED";
  paymentMethod:
    | "CREDIT_CARD"
    | "DEBIT_CARD"
    | "MOBILE_MONEY"
    | "BANK_TRANSFER";
}

export interface IBookingBase {
  id: number;
  userId: number;
  user: IBookingUser;
  numberOfGuests: number;
  specialRequests: string | null;
  paymentDeadline: string;
  payment: IBookingPayment | null;
  status: BookingStatus;
  totalPrice: number;
  bookingDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface ITourBooking extends IBookingBase {
  type: "TOUR";
  tour: IBookingTour;
  room: null;
  flight: null;
}

export interface IRoomBooking extends IBookingBase {
  type: "ROOM";
  room: IBookingRoom | null;
  tour: null;
  flight: null;
}

export interface IFlightBooking extends IBookingBase {
  type: "FLIGHT";
  flight: IBookingFlight;
  tour: null;
  room: null;
}

export type IBooking = ITourBooking | IRoomBooking | IFlightBooking;

export interface IBookingResponse {
  message: string;
  data: IBooking & {
    bookingDetails?: {
      paymentDeadline: string;
      requiresImmediatePayment: boolean;
      calculatedPrice: number;
      numberOfNights?: number;
      tourStartDate?: string;
      flightDeparture?: string;
    };
  };
}

export interface IBookingsPaginatedResponse {
  message: string;
  data: IBooking[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface IBookingInput {
  userId: number;
  tourId?: number | null;
  roomId?: number | null;
  flightId?: number | null;
  totalPrice: number;
  status?: BookingStatus;

  // Room-specific fields
  startDate?: string; // ISO date string, required for room bookings
  endDate?: string; // ISO date string, required for room bookings
  numberOfRooms?: number; // Optional, defaults to 1

  // Common fields
  numberOfGuests?: number; // Optional for all booking types, defaults to 1
  specialRequests?: string | null; // Optional for all booking types
}

export type IUpdateBookingInput = Partial<IBookingInput>;

export interface IDeleteBookingsResponse {
  message: string;
  deletedCount: number;
}

export interface IBookingsQueryParams {
  page?: number;
  limit?: number;
  status?: BookingStatus;
  search?: string;
  type?: "TOUR" | "ROOM" | "FLIGHT";
  tourId?: number;
  roomId?: number;
  flightId?: number;
  fromDate?: string;
  toDate?: string;
}

export interface IBookingsDataTableProps {
  data: IBooking[];
  loading?: boolean;
  totalCount?: number;
  page?: number;
  pageSize?: number;
  filters: Omit<IBookingsQueryParams, "page" | "limit">;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  onFiltersChange: (
    filters: Partial<Omit<IBookingsQueryParams, "page" | "limit">>
  ) => void;
  onRefresh?: () => void;
  showCustomer?: boolean;
}
