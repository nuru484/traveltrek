// src/services/dashboard.service.ts
//
// Dashboard domain logic, extracted from the legacy fat controller. A single
// pure, DI'd function: it takes the acting user's role, owns every Prisma
// count/aggregate, and never touches req/res. The returned object is the
// legacy `data` payload bit-for-bit — base inventory stats for everyone,
// plus the bookings/users blocks only when the actor is ADMIN or AGENT
// (customers never see them; the keys are absent, not empty).
import { UserRole } from '../../types/user-profile.types';
import {
  BookingStatus,
  Role,
  TourStatus,
} from '../config/prismaClient';
import { type AppDeps, defaultDeps } from './deps';

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

export const makeDashboardService = (d: Pick<AppDeps, 'prisma'>) => {
  const { prisma } = d;

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
      // Legacy counted room ROWS (room types), not the totalRooms stock sum.
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
      const [
        totalBookings,
        pendingBookings,
        confirmedBookings,
        completedBookings,
        totalUsers,
        totalCustomers,
        totalAgents,
        totalAdmins,
      ] = await Promise.all([
        prisma.booking.count(),
        prisma.booking.count({ where: { status: BookingStatus.PENDING } }),
        prisma.booking.count({ where: { status: BookingStatus.CONFIRMED } }),
        prisma.booking.count({ where: { status: BookingStatus.COMPLETED } }),
        prisma.user.count(),
        prisma.user.count({ where: { role: Role.CUSTOMER } }),
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
        total: totalUsers,
      };
    }

    return stats;
  };

  return { getDashboardStats };
};

export const dashboardService = makeDashboardService(defaultDeps);

export const { getDashboardStats } = dashboardService;
