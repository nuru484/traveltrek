// src/services/report/tours.service.ts
//
// GET /reports/tours/top-by-bookings — every matching tour is analyzed for the
// summary totals; the topTours list keeps those with >= minBookings period
// bookings, sorted by booking count desc, capped at `limit`.
import { type Prisma } from '#config/prismaClient.js';
import { type ReportCore } from '#services/report/core.js';
import {
  periodEcho,
  periodWindow,
  type ReportDeps,
  topTourBookingSelect,
  topTourSelect,
  type TopToursParams,
  type TopToursReport,
  type TourTopStats,
  windowClause,
} from '#services/report/shared.js';

export const makeReportToursService = (d: ReportDeps, core: ReportCore) => {
  const { prisma } = d;
  const { resolveYear } = core;

  /**
   * GET /reports/tours/top-by-bookings — every matching tour is analyzed
   * (the summary totals cover all of them); the topTours list keeps those
   * with >= minBookings period bookings, sorted by booking count descending,
   * capped at `limit`.
   */
  const getTopToursByBookings = async (
    params: TopToursParams,
  ): Promise<TopToursReport> => {
    const year = resolveYear(params.year);

    const tourWhere: Prisma.TourWhereInput = {};
    if (params.tourType) tourWhere.type = params.tourType;
    if (params.tourStatus) tourWhere.status = params.tourStatus;

    const toursWithBookings = await prisma.tour.findMany({
      select: {
        ...topTourSelect,
        bookings: {
          select: topTourBookingSelect,
          // Nested reads are not auto-scoped; skip soft-deleted bookings.
          where: {
            bookingDate: windowClause(periodWindow(params, year)),
            deletedAt: null,
          },
        },
      },
      where: tourWhere,
    });

    const topTours: TourTopStats[] = toursWithBookings
      .map(({ bookings, ...tour }) => ({
        statistics: {
          confirmedBookings: bookings.filter((b) => b.status === 'CONFIRMED')
            .length,
          totalBookings: bookings.length,
          totalRevenue: bookings.reduce(
            (sum, booking) => sum + booking.totalPrice,
            0,
          ),
        },
        tour,
      }))
      .filter(
        (tourStat) => tourStat.statistics.totalBookings >= params.minBookings,
      )
      .sort((a, b) => b.statistics.totalBookings - a.statistics.totalBookings)
      .slice(0, params.limit);

    return {
      summary: {
        filters: {
          limit: params.limit,
          minBookings: params.minBookings,
          tourStatus: params.tourStatus,
          tourType: params.tourType,
        },
        period: periodEcho(params, year),
        totalBookingsAnalyzed: toursWithBookings.reduce(
          (sum, tour) => sum + tour.bookings.length,
          0,
        ),
        totalRevenueAnalyzed: toursWithBookings.reduce(
          (sum, tour) =>
            sum +
            tour.bookings.reduce(
              (bookingSum, booking) => bookingSum + booking.totalPrice,
              0,
            ),
          0,
        ),
        totalToursAnalyzed: toursWithBookings.length,
      },
      topTours,
    };
  };

  return { getTopToursByBookings };
};
