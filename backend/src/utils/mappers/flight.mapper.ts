// src/utils/mappers/flight.mapper.ts
//
// Pure DTO mappers for the flight domain. Services return Prisma rows (with
// one of the includes below); controllers map them through here so the wire
// format lives in exactly one place and raw DB records never leak.
//
// Three DTO shapes because the legacy wire format differed per endpoint:
// mutations (create/update/status) embedded the FULL origin/destination rows
// and omitted originId/destinationId; the detail read used the four-field
// destination summaries and added the ids; the list used the summaries and
// ids but omitted capacity. All three are preserved bit-for-bit.
import type { Prisma } from '../../config/prismaClient';

/** Destination fields exposed on flight read (detail + list) responses. */
export const flightDestinationSelect = {
  city: true,
  country: true,
  id: true,
  name: true,
} satisfies Prisma.DestinationSelect;

/**
 * Relations for flight mutations — the full destination rows, matching the
 * legacy `include: { destination: true, origin: true }`.
 */
export const flightFullInclude = {
  destination: true,
  origin: true,
} satisfies Prisma.FlightInclude;

/** Relations for flight reads; services pass this to Prisma. */
export const flightSummaryInclude = {
  destination: { select: flightDestinationSelect },
  origin: { select: flightDestinationSelect },
} satisfies Prisma.FlightInclude;

export type FlightDestinationSummary = Prisma.DestinationGetPayload<{
  select: typeof flightDestinationSelect;
}>;

/** Detail (GET /flights/:id) shape: summary relations plus the raw ids. */
export interface FlightDetailDTO extends FlightListItemDTO {
  capacity: number;
}

/** Mutation (create/update/status) shape: full relations, no raw ids. */
export interface FlightDTO {
  airline: string;
  arrival: Date;
  capacity: number;
  createdAt: Date;
  departure: Date;
  destination: FlightWithFullRelations['destination'];
  duration: number;
  flightClass: string;
  flightNumber: string;
  id: number;
  origin: FlightWithFullRelations['origin'];
  photo: null | string;
  price: number;
  seatsAvailable: number;
  status: FlightWithFullRelations['status'];
  stops: number;
  updatedAt: Date;
}

/** List (GET /flights) shape: like the detail but without capacity. */
export interface FlightListItemDTO {
  airline: string;
  arrival: Date;
  createdAt: Date;
  departure: Date;
  destination: FlightDestinationSummary;
  destinationId: number;
  duration: number;
  flightClass: string;
  flightNumber: string;
  id: number;
  origin: FlightDestinationSummary;
  originId: number;
  photo: null | string;
  price: number;
  seatsAvailable: number;
  status: FlightWithSummaryRelations['status'];
  stops: number;
  updatedAt: Date;
}

export type FlightWithFullRelations = Prisma.FlightGetPayload<{
  include: typeof flightFullInclude;
}>;

export type FlightWithSummaryRelations = Prisma.FlightGetPayload<{
  include: typeof flightSummaryInclude;
}>;

export const toFlightDTO = (flight: FlightWithFullRelations): FlightDTO => ({
  airline: flight.airline,
  arrival: flight.arrival,
  capacity: flight.capacity,
  createdAt: flight.createdAt,
  departure: flight.departure,
  destination: flight.destination,
  duration: flight.duration,
  flightClass: flight.flightClass,
  flightNumber: flight.flightNumber,
  id: flight.id,
  origin: flight.origin,
  photo: flight.photo,
  price: flight.price,
  seatsAvailable: flight.seatsAvailable,
  status: flight.status,
  stops: flight.stops,
  updatedAt: flight.updatedAt,
});

export const toFlightDetailDTO = (
  flight: FlightWithSummaryRelations,
): FlightDetailDTO => ({
  ...toFlightListItemDTO(flight),
  capacity: flight.capacity,
});

export const toFlightListItemDTO = (
  flight: FlightWithSummaryRelations,
): FlightListItemDTO => ({
  airline: flight.airline,
  arrival: flight.arrival,
  createdAt: flight.createdAt,
  departure: flight.departure,
  destination: flight.destination,
  destinationId: flight.destinationId,
  duration: flight.duration,
  flightClass: flight.flightClass,
  flightNumber: flight.flightNumber,
  id: flight.id,
  origin: flight.origin,
  originId: flight.originId,
  photo: flight.photo,
  price: flight.price,
  seatsAvailable: flight.seatsAvailable,
  status: flight.status,
  stops: flight.stops,
  updatedAt: flight.updatedAt,
});
