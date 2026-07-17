// src/services/report/self.service.ts
//
// The per-actor "self" reports: GET /reports/me (the authenticated customer's
// own travel activity) and GET /reports/agent-activity (bookings a staff
// member recorded on behalf of customers). Both share the zero-filled
// month-bucket skeleton and the period-window semantics.
import { BookingStatus, PaymentStatus, type Prisma } from '#config/prismaClient.js';
import { UnauthorizedError } from '#middlewares/error-handler.js';
import { type ReportCore } from '#services/report/core.js';
import {
  type AgentActivityParams,
  type AgentActivityReport,
  type CustomerSelfReport,
  monthKeysBetween,
  periodEcho,
  periodWindow,
  type ReportDeps,
  type ReportPeriodParams,
  windowClause,
} from '#services/report/shared.js';
import { UserRole } from '#types/user-profile.types.js';
import { bookingInclude } from '#utils/mappers/booking.mapper.js';

export const makeReportSelfService = (d: ReportDeps, core: ReportCore) => {
  const { clock, prisma } = d;
  const { resolveYear } = core;

  /**
   * GET /reports/me — the authenticated customer's own activity for the
   * period (same startDate/endDate/month/year window semantics as the admin
   * reports). Three reads: the period's booking slice (every booking-derived
   * stat reduces over it), the period's COMPLETED payments (spend), and the
   * 5 most recent bookings with full relations for the DTO list.
   */
  const getCustomerSelfReport = async (
    customerId: number,
    params: ReportPeriodParams,
  ): Promise<CustomerSelfReport> => {
    const year = resolveYear(params.year);
    const window = periodWindow(params, year);

    const [bookings, payments, recentBookings] = await Promise.all([
      prisma.booking.findMany({
        select: {
          bookingDate: true,
          flight: { select: { departure: true } },
          flightId: true,
          roomId: true,
          startDate: true,
          status: true,
          totalPrice: true,
          tour: { select: { startDate: true } },
          tourId: true,
        },
        where: { bookingDate: windowClause(window), customerId },
      }),
      prisma.payment.findMany({
        select: { amount: true, paymentDate: true },
        where: {
          customerId,
          paymentDate: windowClause(window),
          status: PaymentStatus.COMPLETED,
        },
      }),
      prisma.booking.findMany({
        include: bookingInclude,
        orderBy: { createdAt: 'desc' },
        take: 5,
        where: { bookingDate: windowClause(window), customerId },
      }),
    ]);

    const now = clock.timestamp();
    let totalTrips = 0;
    let cancelledBookings = 0;
    let upcomingTrips = 0;
    let totalBookingValue = 0;
    const byType: CustomerSelfReport['byType'] = {};

    // Zero-filled skeleton first so every month of the period reports, even
    // with no activity; bucket order is chronological.
    const monthlyBuckets = new Map<
      string,
      { amount: number; bookings: number; month: string }
    >();
    for (const month of monthKeysBetween(window)) {
      monthlyBuckets.set(month, { amount: 0, bookings: 0, month });
    }

    for (const booking of bookings) {
      totalBookingValue += booking.totalPrice;

      if (booking.status === BookingStatus.COMPLETED) totalTrips += 1;
      if (booking.status === BookingStatus.CANCELLED) cancelledBookings += 1;

      if (
        booking.status === BookingStatus.PENDING ||
        booking.status === BookingStatus.CONFIRMED
      ) {
        const tripStart =
          booking.tour?.startDate ??
          booking.flight?.departure ??
          booking.startDate;
        if (tripStart && tripStart.getTime() > now) upcomingTrips += 1;
      }

      const type = booking.tourId
        ? 'TOUR'
        : booking.roomId
          ? 'ROOM'
          : 'FLIGHT';
      const typeBucket = (byType[type] ??= { amount: 0, count: 0 });
      typeBucket.count += 1;
      typeBucket.amount += booking.totalPrice;

      const monthBucket = monthlyBuckets.get(
        booking.bookingDate.toISOString().slice(0, 7),
      );
      if (monthBucket) monthBucket.bookings += 1;
    }

    let totalSpent = 0;
    for (const payment of payments) {
      totalSpent += payment.amount;
      if (!payment.paymentDate) continue;
      const monthBucket = monthlyBuckets.get(
        payment.paymentDate.toISOString().slice(0, 7),
      );
      if (monthBucket) monthBucket.amount += payment.amount;
    }

    const averageBookingValue =
      bookings.length > 0
        ? Math.round((totalBookingValue / bookings.length) * 100) / 100
        : 0;

    return {
      byType,
      monthlySpend: [...monthlyBuckets.values()],
      recentBookings,
      summary: {
        averageBookingValue,
        cancelledBookings,
        period: periodEcho(params, year),
        totalSpent,
        totalTrips,
        upcomingTrips,
      },
    };
  };

  /**
   * GET /reports/agent-activity — bookings the staff actor recorded on behalf
   * of customers (Booking.createdByUserId) for the period. Agents see only
   * themselves; an ADMIN may pass ?userId= to inspect another agent.
   */
  const getAgentActivity = async (
    actor: { id: number; role: UserRole },
    params: AgentActivityParams,
  ): Promise<AgentActivityReport> => {
    const targetUserId = params.userId ?? actor.id;
    if (actor.role !== UserRole.ADMIN && targetUserId !== actor.id) {
      throw new UnauthorizedError('You can only view your own activity');
    }

    const year = resolveYear(params.year);
    const window = periodWindow(params, year);
    const where: Prisma.BookingWhereInput = {
      bookingDate: windowClause(window),
      createdByUserId: targetUserId,
    };

    const [bookings, recentBookings] = await Promise.all([
      prisma.booking.findMany({
        select: {
          bookingDate: true,
          customerId: true,
          payment: { select: { amount: true, status: true } },
          status: true,
          totalPrice: true,
        },
        where,
      }),
      prisma.booking.findMany({
        include: bookingInclude,
        orderBy: { createdAt: 'desc' },
        take: 5,
        where,
      }),
    ]);

    const customers = new Set<number>();
    let revenueFromRecorded = 0;
    let pendingFromRecorded = 0;

    const monthlyBuckets = new Map<
      string,
      { bookings: number; month: string; revenue: number }
    >();
    for (const month of monthKeysBetween(window)) {
      monthlyBuckets.set(month, { bookings: 0, month, revenue: 0 });
    }

    for (const booking of bookings) {
      customers.add(booking.customerId);

      const paidAmount =
        booking.payment?.status === PaymentStatus.COMPLETED
          ? booking.payment.amount
          : 0;
      revenueFromRecorded += paidAmount;

      if (booking.status === BookingStatus.PENDING) {
        pendingFromRecorded += booking.totalPrice;
      }

      const monthBucket = monthlyBuckets.get(
        booking.bookingDate.toISOString().slice(0, 7),
      );
      if (monthBucket) {
        monthBucket.bookings += 1;
        monthBucket.revenue += paidAmount;
      }
    }

    return {
      monthly: [...monthlyBuckets.values()],
      recentBookings,
      summary: {
        bookingsRecorded: bookings.length,
        customersServed: customers.size,
        pendingFromRecorded,
        period: periodEcho(params, year),
        revenueFromRecorded,
      },
    };
  };

  return { getAgentActivity, getCustomerSelfReport };
};
