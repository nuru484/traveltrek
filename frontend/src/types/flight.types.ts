// src/types/flight.types.ts
export enum IFlightClass {
  ECONOMY = "Economy",
  BUSINESS = "Business",
  FIRST_CLASS = "First Class",
  PREMIUM_ECONOMY = "Premium Economy",
}

export interface IDestinationSummary {
  id: number;
  name: string;
  city: string | null;
  country: string;
}

export type IFlightStatus =
  | "SCHEDULED"
  | "DEPARTED"
  | "LANDED"
  | "CANCELLED"
  | "DELAYED";

export interface IFlight {
  id: number;
  flightNumber: string;
  airline: string;
  departure: string;
  arrival: string;
  origin: IDestinationSummary;
  destination: IDestinationSummary;
  /** Integer minor units (pesewas): GH₵ 1.00 = 100. */
  price: number;
  status: IFlightStatus;
  flightClass: IFlightClass;
  duration: number;
  stops: number;
  photo: string | null;
  seatsAvailable: number;
  capacity: number;
  createdAt: string;
  updatedAt: string;
}

export interface IFlightResponse {
  message: string;
  data: IFlight;
}

export interface IFlightsQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  airline?: string;
  flightClass?: IFlightClass;
  /** Integer minor units (pesewas): GH₵ 1.00 = 100. */
  minPrice?: number;
  /** Integer minor units (pesewas): GH₵ 1.00 = 100. */
  maxPrice?: number;
  originId?: number;
  destinationId?: number;
}

export interface IFlightsPaginatedResponse {
  message: string;
  data: IFlight[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
