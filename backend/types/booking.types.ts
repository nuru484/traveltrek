import { IDestinationSummary } from './destination.types';
export interface IBookingInput {
  userId: number;
  tourId?: number | null;
  roomId?: number | null;
  flightId?: number | null;
  totalPrice: number;
  status?: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
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
  hotel: {
    id: number;
    name: string;
    description: string | null;
    city: string;
    country: string;
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
