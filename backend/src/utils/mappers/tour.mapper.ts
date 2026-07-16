// src/utils/mappers/tour.mapper.ts
//
// Pure DTO mappers for the tour domain. Services return Prisma rows (with
// `tourInclude` relations); controllers map them through here so the wire
// format lives in exactly one place and raw DB records never leak.
import type { Prisma } from '#config/prismaClient.js';

/** Destination fields exposed on tour responses. */
export const destinationSummarySelect = {
  city: true,
  country: true,
  id: true,
  name: true,
} satisfies Prisma.DestinationSelect;

/** Relations every tour read/mutation fetches; services pass this to Prisma. */
export const tourInclude = {
  destination: { select: destinationSummarySelect },
} satisfies Prisma.TourInclude;

export type DestinationSummary = Prisma.DestinationGetPayload<{
  select: typeof destinationSummarySelect;
}>;

export interface TourDTO {
  createdAt: Date;
  description: null | string;
  destination: DestinationSummary;
  duration: number;
  endDate: Date;
  guestsBooked: number;
  id: number;
  maxGuests: number;
  name: string;
  price: number;
  startDate: Date;
  status: TourWithDestination['status'];
  type: TourWithDestination['type'];
  updatedAt: Date;
}

/** Slimmer shape returned by the status-transition endpoint. */
export interface TourStatusDTO {
  destination: DestinationSummary;
  endDate: Date;
  id: number;
  name: string;
  startDate: Date;
  status: TourWithDestination['status'];
}

export type TourWithDestination = Prisma.TourGetPayload<{
  include: typeof tourInclude;
}>;

export const toTourDTO = (tour: TourWithDestination): TourDTO => ({
  createdAt: tour.createdAt,
  description: tour.description,
  destination: tour.destination,
  duration: tour.duration,
  endDate: tour.endDate,
  guestsBooked: tour.guestsBooked,
  id: tour.id,
  maxGuests: tour.maxGuests,
  name: tour.name,
  price: tour.price,
  startDate: tour.startDate,
  status: tour.status,
  type: tour.type,
  updatedAt: tour.updatedAt,
});

export const toTourStatusDTO = (tour: TourWithDestination): TourStatusDTO => ({
  destination: tour.destination,
  endDate: tour.endDate,
  id: tour.id,
  name: tour.name,
  startDate: tour.startDate,
  status: tour.status,
});
