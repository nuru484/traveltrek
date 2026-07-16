// src/utils/mappers/booking.mapper.ts
//
// Pure DTO mapper for the booking domain. Services return Prisma rows (with
// bookingInclude below); controllers map them through here so the wire format
// lives in exactly one place and raw DB records never leak.
//
// toBookingDTO reproduces the legacy formatBookingResponse bit-for-bit: one
// base shape plus a per-type variant (TOUR / ROOM / FLIGHT, checked in that
// order), where the ROOM variant folds the booking-level stay fields
// (startDate/endDate/numberOfNights/numberOfRooms) into the room object. A
// booking with no associated item throws the same 400 the legacy helper did.
// Phase 5b: bookings belong to Customers — the DTO emits customerId + a
// nested customer summary where userId/user used to be.
import type { Prisma } from '#config/prismaClient.js';

import { BadRequestError } from '#middlewares/error-handler.js';

/** Destination summary embedded in tour/room-hotel/flight relations. */
const bookingDestinationSelect = {
  city: true,
  country: true,
  id: true,
  name: true,
} satisfies Prisma.DestinationSelect;

/** Shared include for every booking read/write — the legacy bookingInclude. */
export const bookingInclude = {
  // Staff attribution: who created the booking on the customer's behalf
  // (null for customer self-bookings).
  createdBy: {
    select: { id: true, name: true },
  },
  customer: {
    select: { email: true, id: true, name: true },
  },
  flight: {
    select: {
      airline: true,
      destination: { select: bookingDestinationSelect },
      flightNumber: true,
      id: true,
      origin: { select: bookingDestinationSelect },
    },
  },
  payment: {
    select: {
      amount: true,
      id: true,
      paymentMethod: true,
      status: true,
    },
  },
  room: {
    select: {
      description: true,
      hotel: {
        select: {
          description: true,
          destination: { select: bookingDestinationSelect },
          id: true,
          name: true,
        },
      },
      id: true,
      roomType: true,
    },
  },
  tour: {
    select: {
      description: true,
      destination: { select: bookingDestinationSelect },
      id: true,
      name: true,
    },
  },
} satisfies Prisma.BookingInclude;

export type BookingDTO = FlightBookingDTO | RoomBookingDTO | TourBookingDTO;

export type BookingWithRelations = Prisma.BookingGetPayload<{
  include: typeof bookingInclude;
}>;

export interface FlightBookingDTO extends BookingBaseDTO {
  flight: NonNullable<BookingWithRelations['flight']>;
  room: null;
  tour: null;
  type: 'FLIGHT';
}

export interface RoomBookingDTO extends BookingBaseDTO {
  flight: null;
  room: RoomBookingRoomDTO;
  tour: null;
  type: 'ROOM';
}

/** The room object with the booking's stay details folded in (legacy shape). */
export interface RoomBookingRoomDTO {
  description: null | string;
  endDate: BookingWithRelations['endDate'];
  hotel: NonNullable<BookingWithRelations['room']>['hotel'];
  id: number;
  numberOfNights: number;
  numberOfRooms: number;
  roomType: string;
  startDate: BookingWithRelations['startDate'];
}

export interface TourBookingDTO extends BookingBaseDTO {
  flight: null;
  room: null;
  tour: NonNullable<BookingWithRelations['tour']>;
  type: 'TOUR';
}

/** Fields shared by every booking variant on the wire. */
interface BookingBaseDTO {
  bookingDate: BookingWithRelations['bookingDate'];
  createdAt: BookingWithRelations['createdAt'];
  /** Staff member who created the booking; null for self-bookings. */
  createdBy: BookingWithRelations['createdBy'];
  customer: BookingWithRelations['customer'];
  customerId: number;
  id: number;
  numberOfGuests: number;
  payment: BookingWithRelations['payment'];
  paymentDeadline: BookingWithRelations['paymentDeadline'];
  specialRequests: null | string;
  status: BookingWithRelations['status'];
  totalPrice: number;
  updatedAt: BookingWithRelations['updatedAt'];
}

export const toBookingDTO = (booking: BookingWithRelations): BookingDTO => {
  const baseResponse: BookingBaseDTO = {
    bookingDate: booking.bookingDate,
    createdAt: booking.createdAt,
    createdBy: booking.createdBy,
    customer: booking.customer,
    customerId: booking.customerId,
    id: booking.id,
    numberOfGuests: booking.numberOfGuests,
    payment: booking.payment,
    paymentDeadline: booking.paymentDeadline,
    specialRequests: booking.specialRequests,
    status: booking.status,
    totalPrice: booking.totalPrice,
    updatedAt: booking.updatedAt,
  };

  if (booking.tour) {
    return {
      ...baseResponse,
      flight: null,
      room: null,
      tour: booking.tour,
      type: 'TOUR',
    };
  } else if (booking.room) {
    const roomData: RoomBookingRoomDTO = {
      description: booking.room.description,
      endDate: booking.endDate,
      hotel: booking.room.hotel,
      id: booking.room.id,
      numberOfNights: booking.numberOfNights,
      numberOfRooms: booking.numberOfRooms,
      roomType: booking.room.roomType,
      startDate: booking.startDate,
    };

    return {
      ...baseResponse,
      flight: null,
      room: roomData,
      tour: null,
      type: 'ROOM',
    };
  } else if (booking.flight) {
    return {
      ...baseResponse,
      flight: booking.flight,
      room: null,
      tour: null,
      type: 'FLIGHT',
    };
  }

  throw new BadRequestError(
    'Booking has no associated item (tour, room, or flight)',
  );
};
