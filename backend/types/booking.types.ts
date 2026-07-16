// types/booking.types.ts
import { IDestinationSummary } from './destination.types';
export type IBooking = IFlightBooking | IRoomBooking | ITourBooking;

export interface IBookingBase {
  bookingDate: Date;
  createdAt: Date;
  id: number;
  numberOfGuests: number;
  payment: IBookingPayment | null;
  paymentDeadline: Date;
  specialRequests: string;
  status: 'CANCELLED' | 'COMPLETED' | 'CONFIRMED' | 'PENDING';
  totalPrice: number;
  updatedAt: Date;
  user: IBookingUser;
  userId: number;
}

export interface IBookingFlight {
  airline: string;
  destination: {
    city: null | string;
    country: string;
    id: number;
    name: string;
  };
  flightNumber: string;
  id: number;
  origin: {
    city: null | string;
    country: string;
    id: number;
    name: string;
  };
}

// types/booking.types.ts
export interface IBookingInput {
  endDate?: string; // ISO date string, required for room bookings
  flightId?: null | number;
  // Common fields
  numberOfGuests?: number; // Optional for all booking types, defaults to 1
  numberOfRooms?: number; // Optional, defaults to 1
  roomId?: null | number;
  specialRequests?: null | string; // Optional for all booking types

  // Room-specific fields
  startDate?: string; // ISO date string, required for room bookings
  status?: 'CANCELLED' | 'COMPLETED' | 'CONFIRMED' | 'PENDING';
  totalPrice: number;

  tourId?: null | number;
  userId: number;
}

export interface IBookingPayment {
  amount: number;
  id: number;
  paymentMethod:
    | 'BANK_TRANSFER'
    | 'CREDIT_CARD'
    | 'DEBIT_CARD'
    | 'MOBILE_MONEY';
  status: 'COMPLETED' | 'FAILED' | 'PENDING' | 'REFUNDED';
}

export interface IBookingRoom {
  description: null | string;
  endDate: Date;
  hotel: {
    description: null | string;
    destination: {
      city: string;
      country: string;
      id: number;
      name: string;
    };
    id: number;
    name: string;
  };
  id: number;
  numberOfNights: number;
  numberOfRooms: number;
  roomType: string;
  startDate: Date;
}
export interface IBookingTour {
  description: null | string;
  destination: IDestinationSummary;
  id: number;
  name: string;
}

export interface IBookingUser {
  email: string;
  id: number;
  name: string;
}

export interface IFlightBooking extends IBookingBase {
  flight: IBookingFlight;
  room: null;
  tour: null;
  type: 'FLIGHT';
}

export interface IRoomBooking extends IBookingBase {
  flight: null;
  room: IBookingRoom | null;
  tour: null;
  type: 'ROOM';
}

export interface ITourBooking extends IBookingBase {
  flight: null;
  room: null;
  tour: IBookingTour;
  type: 'TOUR';
}
