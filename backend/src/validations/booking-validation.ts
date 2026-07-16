// src/validations/booking-validation.ts
//
// Zod schemas for the booking domain (replaces the express-validator chains).
// Boundary rules only — shape, formats, ranges, enums. Invariants that need
// the database (user/tour/room/flight existence, capacity and availability
// guards, the status transition map) and the "at least one of tourId, roomId,
// or flightId" rule live in services/booking.service.ts with their legacy
// messages (the old validation-factory custom checks for that rule and for
// roomId-requires-hotelId were attached to absent body fields, so `optional()`
// skipped them — they never actually ran; the handler check was the real
// enforcement and stays the only one).
//
// The legacy chains only validated the owner id, the item ids, hotelId and
// totalPrice; the other fields the handler read (numberOfGuests,
// numberOfRooms, specialRequests, startDate, endDate) went unvalidated. They
// are declared here so the parsed body keeps them, with minimal typing —
// stay dates remain raw strings because the service parses and rejects them
// with the legacy messages ('Check-in date cannot be in the past', ...).
// Phase 5b: bookings belong to Customers, so the owner field is customerId.
import { z } from 'zod';

import { BookingStatus } from '#config/prismaClient.js';
import { BOOKING_TYPES } from '#services/booking.service.js';
import { paginationQuery } from '#validations/common-validation.js';

const BOOKING_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'CANCELLED',
  'COMPLETED',
] as const;

/** Positive integer body field, with the legacy validation-factory messages. */
const intField = (field: string) =>
  z.coerce
    .number(`${field} must be an integer`)
    .int(`${field} must be an integer`)
    .min(1, `${field} must be greater than or equal to 1`);

/** A raw query date string that must at least parse as a date. */
const dateQuery = (message: string) =>
  z.string(message).refine((value) => !isNaN(new Date(value).getTime()), {
    error: message,
  });

const bookingFields = z.object({
  // Admins/agents book on behalf of a customer; customers must self-book
  // (the actor rule in the service keeps the legacy 401).
  customerId: intField('customerId'),
  endDate: z.string().optional(),
  flightId: intField('flightId').optional(),
  // Accepted (the legacy chain validated it) but nothing reads it.
  hotelId: intField('hotelId').optional(),
  numberOfGuests: intField('numberOfGuests').optional(),
  numberOfRooms: intField('numberOfRooms').optional(),
  roomId: intField('roomId').optional(),
  specialRequests: z.string().nullish(),
  startDate: z.string().optional(),
  // Integer minor units (pesewas); the service recalculates it anyway.
  totalPrice: z.coerce
    .number('totalPrice must be a number')
    .int('totalPrice must be an integer (pesewas)')
    .min(0, 'totalPrice must be greater than or equal to 0'),
  tourId: intField('tourId').optional(),
});

/**
 * POST /bookings. customerId and totalPrice stay required — the service
 * recalculates the price, but the legacy contract (and its baseline tests)
 * pin both as mandatory.
 */
export const createBookingSchema = bookingFields;

/** PUT /bookings/:id — everything optional, plus the status enum. */
export const updateBookingSchema = bookingFields.partial().extend({
  status: z
    .enum(
      BOOKING_STATUSES,
      `status must be one of: ${BOOKING_STATUSES.join(', ')}`,
    )
    .optional(),
});

/** `/bookings/:id` route param (legacy express-validator message kept). */
export const bookingIdParam = z.object({
  id: z.coerce
    .number('Booking ID must be a positive integer')
    .int('Booking ID must be a positive integer')
    .min(1, 'Booking ID must be a positive integer'),
});

/** `/bookings/customer/:customerId` route param (legacy message adapted). */
export const bookingCustomerIdParam = z.object({
  customerId: z.coerce
    .number('Invalid customer ID')
    .int('Invalid customer ID')
    .min(1, 'Invalid customer ID'),
});

/**
 * List filters for GET /bookings and GET /bookings/customer/:customerId —
 * the union of what the two legacy handlers parsed by hand, with their
 * messages.
 */
export const bookingListQuery = paginationQuery
  .extend({
    customerId: z.coerce.number().int().min(1).optional(),
    flightId: z.coerce
      .number('Invalid flight ID')
      .int('Invalid flight ID')
      .min(1, 'Invalid flight ID')
      .optional(),
    fromDate: dateQuery('Invalid fromDate format').optional(),
    roomId: z.coerce
      .number('Invalid room ID')
      .int('Invalid room ID')
      .min(1, 'Invalid room ID')
      .optional(),
    search: z.string().optional(),
    status: z.enum(BookingStatus, 'Invalid booking status').optional(),
    toDate: dateQuery('Invalid toDate format').optional(),
    tourId: z.coerce
      .number('Invalid tour ID')
      .int('Invalid tour ID')
      .min(1, 'Invalid tour ID')
      .optional(),
    type: z.enum(BOOKING_TYPES, 'Invalid booking type').optional(),
  })
  .refine(
    (q) =>
      !q.fromDate ||
      !q.toDate ||
      new Date(q.fromDate).getTime() <= new Date(q.toDate).getTime(),
    {
      error: 'fromDate cannot be after toDate',
      path: ['fromDate'],
    },
  );

export type BookingListQueryInput = z.infer<typeof bookingListQuery>;
export type CreateBookingBody = z.infer<typeof createBookingSchema>;
export type UpdateBookingBody = z.infer<typeof updateBookingSchema>;
