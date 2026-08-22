// src/services/booking/shared.ts
//
// Dependency-free building blocks for the bookings domain: the request/result
// types, the booking-type filter values, the status-transition map, and the
// pure night/price helpers. Shared by the booking core and every feature
// module (no closure over the injected deps).
import {
  type BookingStatus,
  BookingStatus as BookingStatusEnum,
} from '#config/prismaClient.js';
import { type AppDeps } from '#services/deps.js';
import { type IUser } from '#types/user-profile.types.js';
import { type BookingWithRelations } from '#utils/mappers/booking.mapper.js';

/** The deps the bookings domain draws from the app container. */
export type BookingDeps = Pick<
  AppDeps,
  'clock' | 'config' | 'logger' | 'notify' | 'prisma'
>;

/** Booking "type" filter values — derived from which relation is set. */
export const BOOKING_TYPES = ['FLIGHT', 'ROOM', 'TOUR'] as const;

export type BookingActor = Pick<IUser, 'id' | 'role'>;

export interface BookingCancelResult {
  booking: BookingWithRelations;
  /** True when a COMPLETED payment moved to REFUND_REQUESTED for admins to
   * action via the refund endpoint. */
  refundRequested: boolean;
}

export interface BookingCreateInput {
  /** The customer the booking is FOR: customers must self-book (actor rule);
   * admins/agents may book on behalf of any customer. */
  customerId: number;
  endDate?: string;
  flightId?: number;
  numberOfGuests?: number;
  numberOfRooms?: number;
  roomId?: number;
  specialRequests?: null | string;
  startDate?: string;
  totalPrice: number;
  tourId?: number;
}

export interface BookingCreateResult {
  booking: BookingWithRelations;
  details: BookingCreationDetails;
}

/** Extra `bookingDetails` block the create response carries. */
export interface BookingCreationDetails {
  calculatedPrice: number;
  flightDeparture?: Date;
  numberOfNights?: number;
  paymentDeadline: Date | null;
  requiresImmediatePayment: boolean;
  tourStartDate?: Date;
}

export interface BookingDeleteSummary {
  deletedBookingId: number;
  restoredAvailability: {
    flight: boolean;
    room: 'date-based' | false;
    tour: boolean;
  };
  restoredQuantities: {
    flightSeats: number;
    tourGuests: number;
  };
}

export interface BookingListParams {
  /** Filter by owner; ignored for customers (always scoped to themselves). */
  customerId?: number;
  flightId?: number;
  /** Raw date strings; the service parses them. */
  fromDate?: string;
  limit: number;
  page: number;
  roomId?: number;
  search?: string;
  status?: BookingStatus;
  toDate?: string;
  tourId?: number;
  type?: BookingType;
}

export type BookingType = (typeof BOOKING_TYPES)[number];

export interface BookingUpdateInput {
  customerId?: number;
  endDate?: string;
  flightId?: number;
  numberOfGuests?: number;
  numberOfRooms?: number;
  roomId?: number;
  specialRequests?: null | string;
  startDate?: string;
  status?: BookingStatus;
  totalPrice?: number;
  tourId?: number;
}

export interface ExpiredBookingsSweepSummary {
  cancelledCount: number;
  failureCount: number;
}

const DAY_MS = 1000 * 60 * 60 * 24;
export const HOUR_MS = 1000 * 60 * 60;

/** Allowed booking-status transitions; terminal states allow none. */
export const VALID_STATUS_TRANSITIONS: Record<BookingStatus, BookingStatus[]> =
  {
    CANCELLED: [],
    COMPLETED: [],
    CONFIRMED: [BookingStatusEnum.COMPLETED, BookingStatusEnum.CANCELLED],
    PENDING: [BookingStatusEnum.CONFIRMED, BookingStatusEnum.CANCELLED],
  };

/** Nights between two dates, midnight-to-midnight. */
export const calculateNights = (startDate: Date, endDate: Date): number => {
  const start = new Date(startDate);
  const end = new Date(endDate);

  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  return Math.ceil((end.getTime() - start.getTime()) / DAY_MS);
};

/** Total price for a room stay. */
export const calculateRoomBookingPrice = (
  pricePerNight: number,
  numberOfNights: number,
  numberOfRooms: number,
): number => pricePerNight * numberOfNights * numberOfRooms;
