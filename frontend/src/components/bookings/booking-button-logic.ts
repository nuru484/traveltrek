// src/components/bookings/booking-button-logic.ts
//
// Pure helpers behind BookingButton: the raw-string count clamps, the price
// calculation and payload assembly. Kept free of React so they can be
// unit-tested directly.
import type { IBookingInput } from "@/types/booking.types";

/** Guests are typed as a raw string; clamp to 1–20 on blur/submit. */
export const clampGuests = (raw: string): number =>
  Math.min(20, Math.max(1, parseInt(raw) || 1));

/** Rooms are typed as a raw string; clamp to 1–10 on blur/submit. */
export const clampRooms = (raw: string): number =>
  Math.min(10, Math.max(1, parseInt(raw) || 1));

/** Total = per-guest price (integer minor units) × guest count. */
export const calculateTotalPrice = (price: number, guests: number): number =>
  price * guests;

export interface IBookingPayloadArgs {
  customerId: number;
  totalPrice: number;
  numberOfGuests: number;
  specialRequests: string;
  tourId?: number;
  flightId?: number;
  roomId?: number;
  startDate?: string;
  endDate?: string;
  numberOfRooms?: number;
}

/**
 * Assembles the create-booking payload for exactly one of tour/flight/room
 * (checked in that order); room bookings carry their date range and room
 * count. Throws when no booking type is given.
 */
export const buildBookingPayload = ({
  customerId,
  totalPrice,
  numberOfGuests,
  specialRequests,
  tourId,
  flightId,
  roomId,
  startDate,
  endDate,
  numberOfRooms }: IBookingPayloadArgs): IBookingInput => {
  const payload: IBookingInput = {
    customerId,
    totalPrice,
    numberOfGuests,
    specialRequests: specialRequests.trim() || null,
  };

  if (tourId) {
    payload.tourId = tourId;
  } else if (flightId) {
    payload.flightId = flightId;
  } else if (roomId) {
    payload.roomId = roomId;
    payload.startDate = startDate;
    payload.endDate = endDate;
    payload.numberOfRooms = numberOfRooms;
  } else {
    throw new Error("No booking type specified");
  }

  return payload;
};
