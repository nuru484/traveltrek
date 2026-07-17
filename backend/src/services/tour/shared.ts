import type { IUser } from '#types/user-profile.types.js';

// src/services/tour/shared.ts
//
// Dependency-free building blocks for the tours domain: the sort-field
// whitelist, request types, and the pure duration helper. Shared by the tour
// core and every feature module.
import { type TourStatus, type TourType } from '#config/prismaClient.js';
import { type AppDeps } from '#services/deps.js';

/** The deps the tours domain draws from the app container. */
export type TourDeps = Pick<
  AppDeps,
  'clock' | 'cloudinary' | 'logger' | 'prisma'
>;

/** Whitelisted `sortBy` fields for tour listings (all indexed-or-scalar). */
export const TOUR_SORT_FIELDS = [
  'createdAt',
  'duration',
  'endDate',
  'guestsBooked',
  'maxGuests',
  'name',
  'price',
  'startDate',
  'updatedAt',
] as const;

/** Filters accepted by the public (unauthenticated) tour listing. */
export interface PublicTourListParams {
  destinationId?: number;
  limit: number;
  page: number;
  search?: string;
  type?: TourType;
}

/** Who performed a mutation, for the audit log line. */
export type TourActor = Pick<IUser, 'id' | 'role'>;

export interface TourInput {
  description?: string;
  destinationId: number;
  endDate: Date;
  maxGuests: number;
  name: string;
  /** Cloudinary URL, already uploaded by the route's middleware. */
  photo?: string;
  price: number;
  startDate: Date;
  type: TourType;
}

export interface TourListParams {
  /** Only tours with seats left (guestsBooked < maxGuests). */
  availableOnly?: boolean;
  city?: string;
  country?: string;
  destinationId?: number;
  /** Tours ending on or before this instant. */
  endDate?: Date;
  limit: number;
  maxDuration?: number;
  /** Bounds on the tour's guest capacity (the maxGuests column). */
  maxGuests?: number;
  maxPrice?: number;
  minDuration?: number;
  minGuests?: number;
  minPrice?: number;
  page: number;
  search?: string;
  sortBy: TourSortField;
  sortOrder: 'asc' | 'desc';
  /** Tours starting on or after this instant. */
  startDate?: Date;
  status?: TourStatus;
  type?: TourType;
}

export type TourSortField = (typeof TOUR_SORT_FIELDS)[number];

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** Whole days between two instants, partial days rounded up. */
export const durationInDays = (start: Date, end: Date): number =>
  Math.ceil((end.getTime() - start.getTime()) / MS_PER_DAY);
