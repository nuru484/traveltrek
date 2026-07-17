// src/services/customer/profile.service.ts
//
// Customer read paths: the list, the FULL profile (identity + lifetime
// activity stats), and the complete booking/payment histories. The profile's
// stat helpers (booking-activity slice, trip-start / destination derivations,
// favorite destination) are local to this module.
import {
  BookingStatus,
  PaymentStatus,
  type Prisma,
} from '#config/prismaClient.js';
import { UnauthorizedError } from '#middlewares/error-handler.js';
import { type CustomerCore } from '#services/customer/core.js';
import {
  canTouchCustomer,
  type CustomerActor,
  type CustomerDeps,
  type CustomerListParams,
  type CustomerProfile,
  type HistoryParams,
} from '#services/customer/shared.js';
import {
  bookingInclude,
  type BookingWithRelations,
} from '#utils/mappers/booking.mapper.js';
import {
  customerSelect,
  type SafeCustomer,
} from '#utils/mappers/customer.mapper.js';
import {
  paymentInclude,
  type PaymentWithRelations,
} from '#utils/mappers/payment.mapper.js';

/** The booking slice the profile stats reduce over: status + timeline plus
 * the destination each product ultimately points at. */
const bookingActivitySelect = {
  createdAt: true,
  flight: {
    select: {
      departure: true,
      destination: { select: { id: true, name: true } },
    },
  },
  room: {
    select: {
      hotel: { select: { destination: { select: { id: true, name: true } } } },
    },
  },
  startDate: true,
  status: true,
  tour: {
    select: {
      destination: { select: { id: true, name: true } },
      startDate: true,
    },
  },
} satisfies Prisma.BookingSelect;

type BookingActivityRow = Prisma.BookingGetPayload<{
  select: typeof bookingActivitySelect;
}>;

/** The date a booking's trip actually starts: the tour's start, the room's
 * check-in (booking.startDate), or the flight's departure. */
const tripStartOf = (row: BookingActivityRow): Date | null =>
  row.tour?.startDate ?? row.flight?.departure ?? row.startDate;

/** The destination a booking ultimately points at (tour's, flight's, or the
 * room's hotel's), or null for malformed rows. */
const destinationOf = (
  row: BookingActivityRow,
): null | { id: number; name: string } =>
  row.tour?.destination ??
  row.flight?.destination ??
  row.room?.hotel.destination ??
  null;

/** The destination booked most often, ties broken by the most recently
 * booked one. Rows must arrive in createdAt ASC order so "latest booking
 * for this destination" is a simple overwrite. */
const favoriteDestinationOf = (
  rows: BookingActivityRow[],
): null | { id: number; name: string } => {
  const tally = new Map<
    number,
    { count: number; latestAt: number; name: string }
  >();
  for (const row of rows) {
    const destination = destinationOf(row);
    if (!destination) continue;
    const entry = tally.get(destination.id) ?? {
      count: 0,
      latestAt: 0,
      name: destination.name,
    };
    entry.count += 1;
    entry.latestAt = row.createdAt.getTime();
    tally.set(destination.id, entry);
  }

  let favorite: null | { id: number; name: string } = null;
  let best = { count: 0, latestAt: 0 };
  for (const [id, entry] of tally) {
    if (
      entry.count > best.count ||
      (entry.count === best.count && entry.latestAt > best.latestAt)
    ) {
      favorite = { id, name: entry.name };
      best = { count: entry.count, latestAt: entry.latestAt };
    }
  }
  return favorite;
};

export const makeCustomerProfileService = (
  d: CustomerDeps,
  core: CustomerCore,
) => {
  const { clock, prisma } = d;
  const { findCustomerOr404 } = core;

  /** GET /customers — newest first, free-text search across name/email/phone. */
  const listCustomers = async (
    params: CustomerListParams,
  ): Promise<{ customers: SafeCustomer[]; total: number }> => {
    const where: Prisma.CustomerWhereInput = {};

    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { email: { contains: params.search, mode: 'insensitive' } },
        { phone: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        orderBy: { createdAt: 'desc' },
        select: customerSelect,
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        where,
      }),
      prisma.customer.count({ where }),
    ]);

    return { customers, total };
  };

  /**
   * GET /customers/:id — the FULL profile: identity plus the lifetime
   * activity stats (see CustomerProfileStats / the mapper for field-by-field
   * docs). Three queries total — one booking slice that every booking-derived
   * stat reduces over (statuses, upcoming trips, last booking, favorite
   * destination), one payment aggregate, one payment count — no N+1. All
   * reads are top-level so the soft-delete scope applies; "upcoming" is
   * judged against the injected clock.
   */
  const getCustomerById = async (
    actor: CustomerActor,
    customerId: number,
  ): Promise<CustomerProfile> => {
    if (!canTouchCustomer(actor, customerId)) {
      throw new UnauthorizedError(
        'You are not authorized to view this customer profile',
      );
    }

    const customer = await findCustomerOr404(customerId);

    const [identity, bookings, completedPayments, totalPayments] =
      await Promise.all([
        // googleId is auth bookkeeping and stays out of customerSelect; the
        // profile only needs it to derive signupMethod.
        prisma.customer.findFirst({
          select: { googleId: true },
          where: { id: customerId },
        }),
        prisma.booking.findMany({
          orderBy: { createdAt: 'asc' },
          select: bookingActivitySelect,
          where: { customerId },
        }),
        prisma.payment.aggregate({
          _count: { _all: true },
          _sum: { amount: true },
          where: { customerId, status: PaymentStatus.COMPLETED },
        }),
        prisma.payment.count({ where: { customerId } }),
      ]);

    const bookingsByStatus: Partial<Record<BookingStatus, number>> = {};
    for (const row of bookings) {
      bookingsByStatus[row.status] = (bookingsByStatus[row.status] ?? 0) + 1;
    }

    const now = clock.timestamp();
    const upcomingTrips = bookings.filter((row) => {
      if (
        row.status !== BookingStatus.PENDING &&
        row.status !== BookingStatus.CONFIRMED
      ) {
        return false;
      }
      const start = tripStartOf(row);
      return start !== null && start.getTime() > now;
    }).length;

    const totalSpent = completedPayments._sum.amount ?? 0;
    const completedCount = completedPayments._count._all;

    return {
      customer,
      stats: {
        averageBookingValue:
          completedCount === 0 ? null : Math.round(totalSpent / completedCount),
        bookingsByStatus,
        favoriteDestination: favoriteDestinationOf(bookings),
        lastBookingAt: bookings.at(-1)?.createdAt ?? null,
        memberSince: customer.createdAt,
        signupMethod: identity?.googleId
          ? 'google'
          : customer.email
            ? 'email'
            : 'phone',
        totalBookings: bookings.length,
        totalPayments,
        totalSpent,
        upcomingTrips,
      },
    };
  };

  /** GET /customers/:id/bookings — the customer's COMPLETE booking history,
   * paginated (newest first), self or staff only. */
  const listCustomerBookingHistory = async (
    actor: CustomerActor,
    customerId: number,
    params: HistoryParams,
  ): Promise<{ bookings: BookingWithRelations[]; total: number }> => {
    if (!canTouchCustomer(actor, customerId)) {
      throw new UnauthorizedError('You can only view your own bookings');
    }
    await findCustomerOr404(customerId);

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        include: bookingInclude,
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        where: { customerId },
      }),
      prisma.booking.count({ where: { customerId } }),
    ]);

    return { bookings, total };
  };

  /** GET /customers/:id/payments — the customer's COMPLETE payment history,
   * paginated (newest first), self or staff only. */
  const listCustomerPaymentHistory = async (
    actor: CustomerActor,
    customerId: number,
    params: HistoryParams,
  ): Promise<{ payments: PaymentWithRelations[]; total: number }> => {
    if (!canTouchCustomer(actor, customerId)) {
      throw new UnauthorizedError('You can only view your own payments');
    }
    await findCustomerOr404(customerId);

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        include: paymentInclude,
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        where: { customerId },
      }),
      prisma.payment.count({ where: { customerId } }),
    ]);

    return { payments, total };
  };

  return {
    getCustomerById,
    listCustomerBookingHistory,
    listCustomerPaymentHistory,
    listCustomers,
  };
};
