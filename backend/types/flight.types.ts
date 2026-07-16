import { FlightStatus } from '../generated/prisma/client';
// types/flight.types.ts
import { IDestinationSummary } from './destination.types';

export interface IFlight {
  airline: string;
  arrival: Date;
  capacity: number;
  createdAt: Date;
  departure: Date;
  destination: IDestinationSummary;
  duration: number;
  flightClass: string;
  flightNumber: string;
  id: number;
  origin: IDestinationSummary;
  photo: null | string;
  price: number;
  seatsAvailable: number;
  status: FlightStatus;
  stops: number;
  updatedAt: Date;
}

export interface IFlightInput {
  airline: string;
  arrival: Date | string;
  capacity: number;
  departure: Date | string;
  destinationId: number;
  flightClass: string;
  flightNumber: string;
  flightPhoto?: Express.Multer.File | string;
  originId: number;
  price: number;
  stops?: number;
}

export interface IFlightResponse {
  data: IFlight;
  message: string;
}

export interface IFlightsPaginatedResponse {
  data: IFlight[];
  message: string;
  meta: {
    filters?: Record<string, unknown>;
    limit: number;
    page: number;
    total: number;
    totalPages: number;
  };
}

export interface IFlightUpdateInput {
  airline?: string;
  arrival?: Date | string;
  capacity?: number;
  departure?: Date | string;
  destinationId?: number;
  flightClass?: string;
  flightNumber?: string;
  flightPhoto?: Express.Multer.File | string;
  originId?: number;
  price?: number;
  status?: FlightStatus;
  stops?: number;
}
