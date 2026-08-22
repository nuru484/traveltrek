// src/services/booking.service.ts
//
// Thin composer for the bookings domain. The implementation is split into
// modules under ./booking: shared.ts (types, the status-transition map, pure
// night/price helpers), core.ts (the DI'd engine — payment-deadline / date
// rules, availability + concurrency-safe inventory claims, the counter-restore
// path, and the list/query helpers), and one module per surface (create,
// update, query, cancel). makeBookingService builds the core once and spreads
// each feature factory into one object, preserving the public surface
// controllers/workers/tests import from this path.
//
// Authorization note: unlike other domains, the booking role rules are NOT
// duplicated by routes/booking.ts (authorizeRole admits ADMIN/AGENT/CUSTOMER
// on most routes), so the actor-based checks live in the service modules —
// customers may only create/read/cancel their own bookings, only admins/agents
// may delete.
import { makeBookingCancelService } from '#services/booking/cancel.service.js';
import { makeBookingCore } from '#services/booking/core.js';
import { makeBookingCreateService } from '#services/booking/create.service.js';
import { makeBookingQueryService } from '#services/booking/query.service.js';
import {
  BOOKING_TYPES,
  type BookingActor,
  type BookingCancelResult,
  type BookingCreateInput,
  type BookingCreateResult,
  type BookingCreationDetails,
  type BookingDeleteSummary,
  type BookingDeps,
  type BookingListParams,
  type BookingType,
  type BookingUpdateInput,
  type ExpiredBookingsSweepSummary,
} from '#services/booking/shared.js';
import { makeBookingUpdateService } from '#services/booking/update.service.js';
import { defaultDeps } from '#services/deps.js';

// Re-export the public types/consts controllers/validation/tests import from
// this module path.
export {
  BOOKING_TYPES,
  type BookingActor,
  type BookingCancelResult,
  type BookingCreateInput,
  type BookingCreateResult,
  type BookingCreationDetails,
  type BookingDeleteSummary,
  type BookingListParams,
  type BookingType,
  type BookingUpdateInput,
  type ExpiredBookingsSweepSummary,
};

export const makeBookingService = (d: BookingDeps) => {
  const core = makeBookingCore(d);
  return {
    ...makeBookingCreateService(d, core),
    ...makeBookingUpdateService(d, core),
    ...makeBookingQueryService(d, core),
    ...makeBookingCancelService(d, core),
  };
};

export const bookingService = makeBookingService(defaultDeps);

export const {
  cancelBooking,
  cancelExpiredBookings,
  createBooking,
  deleteBooking,
  getBookingById,
  listBookings,
  listCustomerBookings,
  updateBooking,
} = bookingService;
