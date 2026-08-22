// src/services/report/bookings.service.ts
//
// GET /reports/bookings/monthly-summary — the period's booking slice + month
// buckets + status breakdown, with per-KPI trends against the equal-length
// previous window.
import { type BookingStatus, type Prisma } from '#config/prismaClient.js';
import { type ReportCore } from '#services/report/core.js';
import {
  type BookingMonthBucket,
  calculateTrend,
  monthlyBookingSelect,
  type MonthlyBookingsParams,
  type MonthlyBookingsReport,
  periodEcho,
  periodWindow,
  previousWindow,
  type ReportDeps,
  windowClause,
} from '#services/report/shared.js';

export const makeReportBookingsService = (d: ReportDeps, core: ReportCore) => {
  const { prisma } = d;
  const { resolveYear } = core;

  /** GET /reports/bookings/monthly-summary — first 10 rows + aggregates. */
  const getMonthlyBookingsSummary = async (
    params: MonthlyBookingsParams,
  ): Promise<MonthlyBookingsReport> => {
    const year = resolveYear(params.year);
    const window = periodWindow(params, year);

    const entityWhere: Prisma.BookingWhereInput = {};
    if (params.tourId) entityWhere.tourId = params.tourId;
    if (params.customerId) entityWhere.customerId = params.customerId;
    if (params.status) entityWhere.status = params.status;

    const [bookings, previousTotals] = await Promise.all([
      prisma.booking.findMany({
        select: monthlyBookingSelect,
        where: { ...entityWhere, bookingDate: windowClause(window) },
      }),
      // Equal-length previous window, same entity filters — feeds the trends.
      prisma.booking.aggregate({
        _count: { _all: true },
        _sum: { totalPrice: true },
        where: {
          ...entityWhere,
          bookingDate: windowClause(previousWindow(window)),
        },
      }),
    ]);

    const totalBookings = bookings.length;
    const totalRevenue = bookings.reduce(
      (sum, booking) => sum + booking.totalPrice,
      0,
    );
    const averageBookingValue =
      totalBookings > 0 ? totalRevenue / totalBookings : 0;

    // Buckets keyed by "YYYY-MM", in first-appearance order.
    const monthlyBuckets = new Map<string, BookingMonthBucket>();
    const statusBreakdown: Partial<Record<BookingStatus, number>> = {};

    for (const booking of bookings) {
      const monthKey = booking.bookingDate.toISOString().slice(0, 7);
      let bucket = monthlyBuckets.get(monthKey);
      if (!bucket) {
        bucket = {
          averageValue: 0,
          bookingCount: 0,
          month: monthKey,
          revenue: 0,
        };
        monthlyBuckets.set(monthKey, bucket);
      }
      bucket.bookingCount += 1;
      bucket.revenue += booking.totalPrice;
      bucket.averageValue = bucket.revenue / bucket.bookingCount;

      statusBreakdown[booking.status] =
        (statusBreakdown[booking.status] ?? 0) + 1;
    }

    const previousBookings = previousTotals._count._all;
    const previousRevenue = previousTotals._sum.totalPrice ?? 0;
    const previousAverage =
      previousBookings > 0 ? previousRevenue / previousBookings : 0;

    return {
      bookings: bookings.slice(0, 10),
      monthlyBreakdown: [...monthlyBuckets.values()],
      statusBreakdown,
      summary: {
        averageBookingValue: Math.round(averageBookingValue * 100) / 100,
        period: periodEcho(params, year),
        totalBookings,
        totalRevenue,
        trends: {
          averageBookingValue: calculateTrend(
            averageBookingValue,
            previousAverage,
          ),
          totalBookings: calculateTrend(totalBookings, previousBookings),
          totalRevenue: calculateTrend(totalRevenue, previousRevenue),
        },
      },
    };
  };

  return { getMonthlyBookingsSummary };
};
