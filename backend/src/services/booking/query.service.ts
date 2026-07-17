// src/services/booking/query.service.ts
//
// Read paths: fetch one booking (customer-scoped), the general paginated list
// (customers scoped to themselves), and the per-customer list. The filter and
// pagination plumbing lives in the booking core.
import { type Prisma } from '#config/prismaClient.js';
import {
  NotFoundError,
  UnauthorizedError,
} from '#middlewares/error-handler.js';
import { type BookingCore } from '#services/booking/core.js';
import {
  type BookingActor,
  type BookingDeps,
  type BookingListParams,
} from '#services/booking/shared.js';
import { UserRole } from '#types/user-profile.types.js';
import {
  bookingInclude,
  type BookingWithRelations,
} from '#utils/mappers/booking.mapper.js';

export const makeBookingQueryService = (d: BookingDeps, core: BookingCore) => {
  const { prisma } = d;
  const { applyListFilters, findPage } = core;

  const getBookingById = async (
    actor: BookingActor,
    id: number,
  ): Promise<BookingWithRelations> => {
    const booking = await prisma.booking.findFirst({
      include: bookingInclude,
      where: { id },
    });
    if (!booking) throw new NotFoundError('Booking not found');

    if (actor.role === UserRole.CUSTOMER && booking.customerId !== actor.id) {
      throw new UnauthorizedError('You can only view your own bookings');
    }

    return booking;
  };

  const listBookings = async (
    actor: BookingActor,
    params: BookingListParams,
  ): Promise<{ bookings: BookingWithRelations[]; total: number }> => {
    const where: Prisma.BookingWhereInput = {};

    if (actor.role === UserRole.CUSTOMER) {
      where.customerId = actor.id;
    }

    if (params.customerId && actor.role !== UserRole.CUSTOMER) {
      where.customerId = params.customerId;
    }

    applyListFilters(where, params, params.search);

    return findPage(where, params.page, params.limit);
  };

  /** GET /bookings/customer/:customerId — a customer may only list their own. */
  const listCustomerBookings = async (
    actor: BookingActor,
    customerId: number,
    params: BookingListParams,
  ): Promise<{ bookings: BookingWithRelations[]; total: number }> => {
    if (actor.role === UserRole.CUSTOMER && actor.id !== customerId) {
      throw new UnauthorizedError('You can only view your own bookings');
    }

    const where: Prisma.BookingWhereInput = { customerId };

    // The legacy handler trimmed and truncated the search term (the general
    // list endpoint used it raw); preserved.
    applyListFilters(where, params, params.search?.trim().slice(0, 100));

    return findPage(where, params.page, params.limit);
  };

  return { getBookingById, listBookings, listCustomerBookings };
};
