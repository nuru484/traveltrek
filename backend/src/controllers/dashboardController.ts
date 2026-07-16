// src/controllers/dashboardController.ts
import { NextFunction, Request, Response } from 'express';

import { HTTP_STATUS_CODES } from '../config/constants';
import prisma from '../config/prismaClient';
import { asyncHandler } from '../middlewares/error-handler';

interface IDashboardResponse {
  data: IDashboardStats;
  message: string;
}

interface IDashboardStats {
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
  users?: {
    admins: number;
    agents: number;
    customers: number;
    total: number;
  };
}

/**
 * Get dashboard statistics
 */
const getDashboardStats = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userRole = req.user?.role;

    try {
      // Base stats that all users can see
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
        // Tours stats
        prisma.tour.count(),
        prisma.tour.count({
          where: { status: 'UPCOMING' },
        }),
        prisma.tour.count({
          where: { status: 'ONGOING' },
        }),

        // Hotels stats
        prisma.hotel.count(),
        prisma.room.count({}),

        // Flights stats
        prisma.flight.count(),
        prisma.flight.aggregate({
          _sum: {
            seatsAvailable: true,
          },
        }),

        // Destinations stats
        prisma.destination.count(),
      ]);

      const dashboardStats: IDashboardStats = {
        destinations: {
          total: totalDestinations,
        },
        flights: {
          availableSeats: totalSeatsAvailable._sum.seatsAvailable || 0,
          total: totalFlights,
        },
        hotels: {
          availableRooms: availableRooms,
          total: totalHotels,
        },
        tours: {
          ongoing: ongoingTours,
          total: totalTours,
          upcoming: upcomingTours,
        },
      };

      // Add additional stats for admin/agent users
      if (userRole === 'ADMIN' || userRole === 'AGENT') {
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
          // Bookings stats
          prisma.booking.count(),
          prisma.booking.count({
            where: { status: 'PENDING' },
          }),
          prisma.booking.count({
            where: { status: 'CONFIRMED' },
          }),
          prisma.booking.count({
            where: { status: 'COMPLETED' },
          }),

          // Users stats
          prisma.user.count(),
          prisma.user.count({
            where: { role: 'CUSTOMER' },
          }),
          prisma.user.count({
            where: { role: 'AGENT' },
          }),
          prisma.user.count({
            where: { role: 'ADMIN' },
          }),
        ]);

        dashboardStats.bookings = {
          completed: completedBookings,
          confirmed: confirmedBookings,
          pending: pendingBookings,
          total: totalBookings,
        };

        dashboardStats.users = {
          admins: totalAdmins,
          agents: totalAgents,
          customers: totalCustomers,
          total: totalUsers,
        };
      }

      const response: IDashboardResponse = {
        data: dashboardStats,
        message: 'Dashboard statistics retrieved successfully',
      };

      res.status(HTTP_STATUS_CODES.OK).json(response);
    } catch (error) {
      next(error);
    }
  },
);

export { getDashboardStats };
