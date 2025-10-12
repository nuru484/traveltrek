import { IDestinationSummary } from './destination.types';
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

export interface IFlightResponse {
  id: number;
  flightNumber: string;
  airline: string;
  departure: Date;
  arrival: Date;
  origin: IDestinationSummary;
  destination: IDestinationSummary;
  price: number;
  flightClass: string;
  duration: number;
  stops: number;
  photo: string | null;
  seatsAvailable: number;
  capacity: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IFlightsPaginatedResponse {
  message: string;
  data: IFlightResponse[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
