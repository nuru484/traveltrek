import type { IUser } from '#types/user-profile.types.js';

// src/services/flight/shared.ts
//
// Dependency-free building blocks for the flights domain: the sort-field
// whitelist, request/result types, the non-deletable status set, and the
// deps type. Shared by the flight core and every feature module.
import { FlightStatus } from '#config/prismaClient.js';
import { type AppDeps } from '#services/deps.js';

/** The deps the flights domain draws from the app container. */
export type FlightDeps = Pick<
  AppDeps,
  'clock' | 'cloudinary' | 'logger' | 'prisma'
>;

/** Whitelisted `sortBy` fields for flight listings. */
export const FLIGHT_SORT_FIELDS = [
  'airline',
  'arrival',
  'createdAt',
  'departure',
  'duration',
  'flightNumber',
  'price',
] as const;

export type FlightActor = Pick<IUser, 'id' | 'role'>;

export interface FlightDeleteSummary {
  deletedAt: string;
  flightNumber: string;
  id: number;
  status: FlightStatus;
}

export interface FlightInput {
  airline: string;
  arrival: Date;
  capacity: number;
  departure: Date;
  destinationId: number;
  flightClass: string;
  flightNumber: string;
  originId: number;
  /** Cloudinary URL, already uploaded by the route's middleware. */
  photo?: string;
  price: number;
  stops?: number;
}

export interface FlightListParams {
  airline?: string;
  /** Raw date strings; the service parses them. */
  departureFrom?: string;
  departureTo?: string;
  destinationId?: number;
  flightClass?: string;
  limit: number;
  maxDuration?: number;
  maxPrice?: number;
  maxStops?: number;
  minPrice?: number;
  minSeats?: number;
  originId?: number;
  page: number;
  search?: string;
  sortBy: FlightSortField;
  sortOrder: 'asc' | 'desc';
}

export type FlightSortField = (typeof FLIGHT_SORT_FIELDS)[number];

/**
 * PATCH /flights/:id/status payload. Times stay raw strings: the DELAYED path
 * parses and rejects them.
 */
export interface FlightStatusChangeInput {
  arrival?: string;
  departure?: string;
  status: FlightStatus;
}

export interface FlightUpdateInput extends Partial<FlightInput> {
  /** A PUT may only set DELAYED or CANCELLED; the state machine owns the rest. */
  status?: FlightStatus;
}

/** Filters accepted by the public (unauthenticated) flight listing. */
export interface PublicFlightListParams {
  destinationId?: number;
  limit: number;
  originId?: number;
  page: number;
  search?: string;
}

/** Statuses that block a single-flight delete. */
export const NON_DELETABLE_STATUSES: FlightStatus[] = [
  FlightStatus.DEPARTED,
  FlightStatus.LANDED,
  FlightStatus.DELAYED,
];

export const MINUTE_MS = 1000 * 60;
