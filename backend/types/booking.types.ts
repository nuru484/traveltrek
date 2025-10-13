// types/booking.types.ts
import { IDestinationSummary } from './destination.types';
// types/booking.types.ts
export interface IBookingInput {
  userId: number;
  tourId?: number | null;
  roomId?: number | null;
  flightId?: number | null;
  totalPrice: number;
  status?: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';

  // Room-specific fields
  startDate?: string; // ISO date string, required for room bookings
  endDate?: string; // ISO date string, required for room bookings
  numberOfRooms?: number; // Optional, defaults to 1

  // Common fields
  numberOfGuests?: number; // Optional for all booking types, defaults to 1
  specialRequests?: string | null; // Optional for all booking types
}

export interface IBookingUser {
  id: number;
  name: string;
  email: string;
}

export interface IBookingRoom {
  id: number;
  roomType: string;
  description: string | null;
  numberOfRooms: number;
  numberOfNights: number;
  startDate: Date;
  endDate: Date;
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

export interface IBookingTour {
  id: number;
  name: string;
  description: string | null;
  destination: IDestinationSummary;
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

export interface IBookingPayment {
  id: number;
  amount: number;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  paymentMethod:
    | 'CREDIT_CARD'
    | 'DEBIT_CARD'
    | 'MOBILE_MONEY'
    | 'BANK_TRANSFER';
}
export interface IBookingBase {
  id: number;
  userId: number;
  user: IBookingUser;
  numberOfGuests: number;
  specialRequests: string;
  paymentDeadline: Date
  payment: IBookingPayment | null;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
  totalPrice: number;
  bookingDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITourBooking extends IBookingBase {
  type: 'TOUR';
  tour: IBookingTour;
  room: null;
  flight: null;
}

export interface IRoomBooking extends IBookingBase {
  type: 'ROOM';
  room: IBookingRoom | null;
  tour: null;
  flight: null;
}

export interface IFlightBooking extends IBookingBase {
  type: 'FLIGHT';
  flight: IBookingFlight;
  tour: null;
  room: null;
}

export type IBooking = ITourBooking | IRoomBooking | IFlightBooking;
