import {
  BookingStatus,
  PaymentStatus,
  Role,
  TourStatus,
} from '#config/prismaClient.js';
import { type AppDeps, defaultDeps } from '#services/deps.js';
// src/services/dashboard.service.ts
//
// Dashboard domain logic. Pure, DI'd functions: they own every Prisma
// count/aggregate and never touch req/res. getDashboardStats returns the
// documented `data` payload: base inventory stats for everyone, plus the
// bookings/users blocks only when the actor is ADMIN or AGENT (customers
// never see them; the keys are absent, not empty). getNeedsAttention powers
// the staff dashboard's operational strip.
import { UserRole } from '#types/user-profile.types.js';

export interface DashboardStats {
  /** ADMIN/AGENT only. */
  bookings?: {
    completed: number;
    confirmed: number;
    pending: number;
    total: number;
  };
  destinations: {
    total: number;
  };
  flights: {
    availableSeats: number;
    total: number;
  };
  hotels: {
    availableRooms: number;
    total: number;
  };
  tours: {
    ongoing: number;
    total: number;
    upcoming: number;
  };
  /** ADMIN/AGENT only. */
  users?: {
    admins: number;
    agents: number;
    customers: number;
    total: number;
  };
}

/** Live operational counts for the staff dashboard's attention strip. */
export interface NeedsAttentionCounts {
  failedPayments: number;
  flightsDepartingSoonLowSeats: number;
  pendingBookings: number;
  pendingPayments: number;
  upcomingToursLowOccupancy: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** Flights departing within this many days are "departing soon". */
const FLIGHT_DEPARTING_SOON_DAYS = 7;
/** A departing-soon flight with > 70% of its seats unsold needs attention. */
const FLIGHT_UNSOLD_SEATS_RATIO = 0.7;
/** A starting-soon tour with < 30% of its capacity booked needs attention. */
const TOUR_LOW_OCCUPANCY_RATIO = 0.3;
/** Tours starting within this many days are "starting soon". */
const TOUR_STARTING_SOON_DAYS = 14;

export const makeDashboardService = (
  d: Pick<AppDeps, 'clock' | 'prisma'>,
) => {
  const { clock, prisma } = d;

  /** GET /dashboard — inventory stats, widened for ADMIN/AGENT actors. */
  const getDashboardStats = async (
    role: undefined | UserRole,
  ): Promise<DashboardStats> => {
    const [
      totalTours,
      upcomingTours,
      ongoingTours,
      totalHotels,
      availableRooms,
      totalFlights,
      totalSeatsAvailable,
      totalDestinations,
    ] = await Promise.all([
      prisma.tour.count(),
      prisma.tour.count({ where: { status: TourStatus.UPCOMING } }),
      prisma.tour.count({ where: { status: TourStatus.ONGOING } }),
      prisma.hotel.count(),
      // Counts room ROWS (room types), not the totalRooms stock sum.
      prisma.room.count(),
      prisma.flight.count(),
      prisma.flight.aggregate({ _sum: { seatsAvailable: true } }),
      prisma.destination.count(),
    ]);

    const stats: DashboardStats = {
      destinations: {
        total: totalDestinations,
      },
      flights: {
        availableSeats: totalSeatsAvailable._sum.seatsAvailable ?? 0,
        total: totalFlights,
      },
      hotels: {
        availableRooms,
        total: totalHotels,
      },
      tours: {
        ongoing: ongoingTours,
        total: totalTours,
        upcoming: upcomingTours,
      },
    };

    if (role === UserRole.ADMIN || role === UserRole.AGENT) {
      // Customers live in their own table; User is staff-only, so `total`
      // (every account) is staff + customers.
      const [
        totalBookings,
        pendingBookings,
        confirmedBookings,
        completedBookings,
        totalCustomers,
        totalAgents,
        totalAdmins,
      ] = await Promise.all([
        prisma.booking.count(),
        prisma.booking.count({ where: { status: BookingStatus.PENDING } }),
        prisma.booking.count({ where: { status: BookingStatus.CONFIRMED } }),
        prisma.booking.count({ where: { status: BookingStatus.COMPLETED } }),
        prisma.customer.count(),
        prisma.user.count({ where: { role: Role.AGENT } }),
        prisma.user.count({ where: { role: Role.ADMIN } }),
      ]);

      stats.bookings = {
        completed: completedBookings,
        confirmed: confirmedBookings,
        pending: pendingBookings,
        total: totalBookings,
      };

      stats.users = {
        admins: totalAdmins,
        agents: totalAgents,
        customers: totalCustomers,
        total: totalAdmins + totalAgents + totalCustomers,
      };
    }

    return stats;
  };

  /**
   * GET /dashboard/needs-attention — live operational counts (staff only).
   * Occupancy/seat ratios compare two columns, which plain Prisma filters
   * can't express, so the small windowed candidate sets are counted in JS.
   */
  const getNeedsAttention = async (): Promise<NeedsAttentionCounts> => {
    const now = clock.now();
    const tourHorizon = new Date(
      now.getTime() + TOUR_STARTING_SOON_DAYS * DAY_MS,
    );
    const flightHorizon = new Date(
      now.getTime() + FLIGHT_DEPARTING_SOON_DAYS * DAY_MS,
    );

    const [
      pendingBookings,
      pendingPayments,
      failedPayments,
      startingSoonTours,
      departingSoonFlights,
    ] = await Promise.all([
      prisma.booking.count({ where: { status: BookingStatus.PENDING } }),
      prisma.payment.count({ where: { status: PaymentStatus.PENDING } }),
      prisma.payment.count({ where: { status: PaymentStatus.FAILED } }),
      prisma.tour.findMany({
        select: { guestsBooked: true, maxGuests: true },
        where: { startDate: { gte: now, lte: tourHorizon } },
      }),
      prisma.flight.findMany({
        select: { capacity: true, seatsAvailable: true },
        where: { departure: { gte: now, lte: flightHorizon } },
      }),
    ]);

    return {
      failedPayments,
      flightsDepartingSoonLowSeats: departingSoonFlights.filter(
        (flight) =>
          flight.seatsAvailable > FLIGHT_UNSOLD_SEATS_RATIO * flight.capacity,
      ).length,
      pendingBookings,
      pendingPayments,
      upcomingToursLowOccupancy: startingSoonTours.filter(
        (tour) => tour.guestsBooked < TOUR_LOW_OCCUPANCY_RATIO * tour.maxGuests,
      ).length,
    };
  };

  return { getDashboardStats, getNeedsAttention };
};

export const dashboardService = makeDashboardService(defaultDeps);

export const { getDashboardStats, getNeedsAttention } = dashboardService;
