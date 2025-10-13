// types/flight.types.ts
import { IDestinationSummary } from './destination.types';
import { FlightStatus } from '../generated/prisma';

export interface IFlightInput {
  flightNumber: string;
  airline: string;
  departure: string | Date;
  arrival: string | Date;
  originId: number;
  destinationId: number;
  price: number;
  flightClass: string;
  stops?: number;
  flightPhoto?: string | Express.Multer.File;
  capacity: number;
}

export interface IFlightUpdateInput {
  flightNumber?: string;
  airline?: string;
  departure?: string | Date;
  arrival?: string | Date;
  originId?: number;
  destinationId?: number;
  price?: number;
  flightClass?: string;
  stops?: number;
  flightPhoto?: string | Express.Multer.File;
  capacity?: number;
  status?: FlightStatus; 
}

export interface IFlight {
  id: number;
  flightNumber: string;
  airline: string;
  departure: Date;
  arrival: Date;
  origin: IDestinationSummary;
  destination: IDestinationSummary;
  price: number;
  status: FlightStatus;
  flightClass: string;
  duration: number;
  stops: number;
  photo: string | null;
  seatsAvailable: number;
  capacity: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IFlightResponse {
  message: string;
  data: IFlight;
}

export interface IFlightsPaginatedResponse {
  message: string;
  data: IFlight[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    filters?: any;
  };
}