// src/controllers/reportsController.ts
import { Request, Response, NextFunction, RequestHandler } from 'express';
import prisma from '../config/prismaClient';
import validationMiddleware from '../middlewares/validation';
import { asyncHandler } from '../middlewares/error-handler';
import { HTTP_STATUS_CODES } from '../config/constants';
import {
  IMonthlyBookingsResponse,
  IPaymentsSummaryResponse,
  ITopToursResponse,
  IReportsQueryParams,
} from 'types/reports.types';
import {
  monthlyBookingsValidation,
  topToursValidation,
  paymentsSummaryValidation,
} from '../validations/reports-validations';

const handleGetMonthlyBookingsSummary = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const {
      year = new Date().getFullYear(),
      month,
      startDate,
      endDate,
      tourId,
      userId,
      status,
    }: IReportsQueryParams = req.query;

    let dateFilter: any = {};

    if (startDate && endDate) {
      dateFilter = {
        bookingDate: {
          gte: new Date(startDate as string),
          lte: new Date(endDate as string),
        },
      };
    } else if (year && month) {
      const startOfMonth = new Date(Number(year), Number(month) - 1, 1);
      const endOfMonth = new Date(Number(year), Number(month), 0, 23, 59, 59);
      dateFilter = {
        bookingDate: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      };
    } else if (year) {
      const startOfYear = new Date(Number(year), 0, 1);
      const endOfYear = new Date(Number(year), 11, 31, 23, 59, 59);
      dateFilter = {
        bookingDate: {
          gte: startOfYear,
          lte: endOfYear,
        },
      };
    }

    const where: any = {
      ...dateFilter,
    };

    if (tourId) {
      where.tourId = Number(tourId);
    }

    if (userId) {
      where.userId = Number(userId);
    }

    if (status) {
      where.status = status;
    }

    const bookings = await prisma.booking.findMany({
      where,
      select: {
        id: true,
        totalPrice: true,
        bookingDate: true,
        status: true,
        tour: {
          select: {
            id: true,
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    const totalBookings = bookings.length;
    const totalRevenue = bookings.reduce(
      (sum, booking) => sum + booking.totalPrice,
      0,
    );
    const averageBookingValue =
      totalBookings > 0 ? totalRevenue / totalBookings : 0;

    const monthlyBreakdown = bookings.reduce((acc, booking) => {
      const monthKey = booking.bookingDate.toISOString().slice(0, 7);

      if (!acc[monthKey]) {
        acc[monthKey] = {
          month: monthKey,
          bookingCount: 0,
          revenue: 0,
          averageValue: 0,
        };
      }

      acc[monthKey].bookingCount += 1;
      acc[monthKey].revenue += booking.totalPrice;
      acc[monthKey].averageValue =
        acc[monthKey].revenue / acc[monthKey].bookingCount;

      return acc;
    }, {} as any);

    const statusBreakdown = bookings.reduce((acc, booking) => {
      acc[booking.status] = (acc[booking.status] || 0) + 1;
      return acc;
    }, {} as any);

    const response: IMonthlyBookingsResponse = {
      message: 'Monthly bookings summary retrieved successfully',
      data: {
        summary: {
          totalBookings,
          totalRevenue,
          averageBookingValue: Math.round(averageBookingValue * 100) / 100,
          period: {
            year: Number(year),
            month: month ? Number(month) : null,
            startDate: startDate as string,
            endDate: endDate as string,
          },
        },
        monthlyBreakdown: Object.values(monthlyBreakdown),
        statusBreakdown,
        bookings: bookings.slice(0, 10),
      },
    };

    res.status(HTTP_STATUS_CODES.OK).json(response);
  },
);

export const getMonthlyBookingsSummary: RequestHandler[] = [
  ...validationMiddleware.create(monthlyBookingsValidation),
  handleGetMonthlyBookingsSummary,
];

const handleGetPaymentsSummary = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const {
      year = new Date().getFullYear(),
      month,
      startDate,
      endDate,
      paymentMethod,
      status,
      userId,
      currency = 'GHS',
    }: IReportsQueryParams = req.query;

    let dateFilter: any = {};

    if (startDate && endDate) {
      dateFilter = {
        paymentDate: {
          gte: new Date(startDate as string),
          lte: new Date(endDate as string),
        },
      };
    } else if (year && month) {
      const startOfMonth = new Date(Number(year), Number(month) - 1, 1);
      const endOfMonth = new Date(Number(year), Number(month), 0, 23, 59, 59);
      dateFilter = {
        paymentDate: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      };
    } else if (year) {
      const startOfYear = new Date(Number(year), 0, 1);
      const endOfYear = new Date(Number(year), 11, 31, 23, 59, 59);
      dateFilter = {
        paymentDate: {
          gte: startOfYear,
          lte: endOfYear,
        },
      };
    }

    const where: any = {
      ...dateFilter,
    };

    if (paymentMethod) {
      where.paymentMethod = paymentMethod;
    }

    if (status) {
      where.status = status;
    }

    if (userId) {
      where.userId = Number(userId);
    }

    if (currency) {
      where.currency = currency;
    }

    const payments = await prisma.payment.findMany({
      where,
      select: {
        id: true,
        amount: true,
        currency: true,
        status: true,
        paymentMethod: true,
        paymentDate: true,
        transactionReference: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        booking: {
          select: {
            id: true,
            totalPrice: true,
            tour: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    const totalPayments = payments.length;
    const totalRevenue = payments
      .filter((p) => p.status === 'COMPLETED')
      .reduce((sum, payment) => sum + payment.amount, 0);
    const pendingAmount = payments
      .filter((p) => p.status === 'PENDING')
      .reduce((sum, payment) => sum + payment.amount, 0);
    const failedAmount = payments
      .filter((p) => p.status === 'FAILED')
      .reduce((sum, payment) => sum + payment.amount, 0);
    const refundedAmount = payments
      .filter((p) => p.status === 'REFUNDED')
      .reduce((sum, payment) => sum + payment.amount, 0);

    const statusBreakdown = payments.reduce((acc, payment) => {
      if (!acc[payment.status]) {
        acc[payment.status] = {
          count: 0,
          amount: 0,
        };
      }
      acc[payment.status].count += 1;
      acc[payment.status].amount += payment.amount;
      return acc;
    }, {} as any);

    const methodBreakdown = payments.reduce((acc, payment) => {
      if (!acc[payment.paymentMethod]) {
        acc[payment.paymentMethod] = {
          count: 0,
          amount: 0,
        };
      }
      acc[payment.paymentMethod].count += 1;
      acc[payment.paymentMethod].amount += payment.amount;
      return acc;
    }, {} as any);

    // Monthly breakdown
    const monthlyBreakdown = payments.reduce((acc, payment) => {
      if (!payment.paymentDate) return acc;

      const monthKey = payment.paymentDate.toISOString().slice(0, 7);

      if (!acc[monthKey]) {
        acc[monthKey] = {
          month: monthKey,
          count: 0,
          revenue: 0,
        };
      }

      acc[monthKey].count += 1;
      if (payment.status === 'COMPLETED') {
        acc[monthKey].revenue += payment.amount;
      }

      return acc;
    }, {} as any);

    const response: IPaymentsSummaryResponse = {
      message: 'Payments summary retrieved successfully',
      data: {
        summary: {
          totalPayments,
          totalRevenue,
          pendingAmount,
          failedAmount,
          refundedAmount,
          currency: currency as string,
          period: {
            year: Number(year),
            month: month ? Number(month) : null,
            startDate: startDate as string,
            endDate: endDate as string,
          },
        },
        statusBreakdown,
        methodBreakdown,
        monthlyBreakdown: Object.values(monthlyBreakdown),
        recentPayments: payments
          .sort(
            (a, b) =>
              (b.paymentDate?.getTime() || 0) - (a.paymentDate?.getTime() || 0),
          )
          .slice(0, 10),
      },
    };

    res.status(HTTP_STATUS_CODES.OK).json(response);
  },
);

export const getPaymentsSummary: RequestHandler[] = [
  ...validationMiddleware.create(paymentsSummaryValidation),
  handleGetPaymentsSummary,
];

const handleGetTopToursByBookings = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const {
      year = new Date().getFullYear(),
      month,
      startDate,
      endDate,
      tourType,
      tourStatus,
      limit = 5,
      minBookings = 1,
    }: IReportsQueryParams = req.query;

    let bookingDateFilter: any = {};

    if (startDate && endDate) {
      bookingDateFilter = {
        bookingDate: {
          gte: new Date(startDate as string),
          lte: new Date(endDate as string),
        },
      };
    } else if (year && month) {
      const startOfMonth = new Date(Number(year), Number(month) - 1, 1);
      const endOfMonth = new Date(Number(year), Number(month), 0, 23, 59, 59);
      bookingDateFilter = {
        bookingDate: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      };
    } else if (year) {
      const startOfYear = new Date(Number(year), 0, 1);
      const endOfYear = new Date(Number(year), 11, 31, 23, 59, 59);
      bookingDateFilter = {
        bookingDate: {
          gte: startOfYear,
          lte: endOfYear,
        },
      };
    }

    const tourWhere: any = {};
    if (tourType) {
      tourWhere.type = tourType;
    }
    if (tourStatus) {
      tourWhere.status = tourStatus;
    }

    const toursWithBookings = await prisma.tour.findMany({
      where: tourWhere,
      select: {
        id: true,
        name: true,
        description: true,
        type: true,
        status: true,
        price: true,
        duration: true,
        startDate: true,
        endDate: true,
        maxGuests: true,
        destination: {
          select: {
            id: true,
            name: true,
            city: true,
            country: true,
          },
        },
        bookings: {
          where: bookingDateFilter,
          select: {
            id: true,
            totalPrice: true,
            status: true,
            bookingDate: true,
          },
        },
        reviews: {
          select: {
            id: true,
            rating: true,
          },
        },
      },
    });

    const tourStats = toursWithBookings
      .map((tour) => {
        const totalBookings = tour.bookings.length;
        const confirmedBookings = tour.bookings.filter(
          (b) => b.status === 'CONFIRMED',
        ).length;
        const totalRevenue = tour.bookings.reduce(
          (sum, booking) => sum + booking.totalPrice,
          0,
        );
        const averageRating =
          tour.reviews.length > 0
            ? tour.reviews.reduce((sum, review) => sum + review.rating, 0) /
              tour.reviews.length
            : 0;

        return {
          tour: {
            id: tour.id,
            name: tour.name,
            description: tour.description,
            type: tour.type,
            status: tour.status,
            price: tour.price,
            duration: tour.duration,
            destination: tour.destination,
            startDate: tour.startDate,
            endDate: tour.endDate,
            maxGuests: tour.maxGuests,
          },
          statistics: {
            totalBookings,
            confirmedBookings,
            totalRevenue,
            averageRating: Math.round(averageRating * 10) / 10,
            reviewCount: tour.reviews.length,
          },
        };
      })
      .filter(
        (tourStat) => tourStat.statistics.totalBookings >= Number(minBookings),
      )
      .sort((a, b) => b.statistics.totalBookings - a.statistics.totalBookings)
      .slice(0, Number(limit));

    const totalToursAnalyzed = toursWithBookings.length;
    const totalBookingsAnalyzed = toursWithBookings.reduce(
      (sum, tour) => sum + tour.bookings.length,
      0,
    );
    const totalRevenueAnalyzed = toursWithBookings.reduce(
      (sum, tour) =>
        sum +
        tour.bookings.reduce(
          (bookingSum, booking) => bookingSum + booking.totalPrice,
          0,
        ),
      0,
    );

    const response: ITopToursResponse = {
      message: `Top ${tourStats.length} tours by booking count retrieved successfully`,
      data: {
        summary: {
          totalToursAnalyzed,
          totalBookingsAnalyzed,
          totalRevenueAnalyzed,
          period: {
            year: Number(year),
            month: month ? Number(month) : null,
            startDate: startDate as string,
            endDate: endDate as string,
          },
          filters: {
            tourType: tourType,
            tourStatus: tourStatus,
            minBookings: Number(minBookings),
            limit: Number(limit),
          },
        },
        topTours: tourStats,
      },
    };

    res.status(HTTP_STATUS_CODES.OK).json(response);
  },
);

export const getTopToursByBookings: RequestHandler[] = [
  ...validationMiddleware.create(topToursValidation),
  handleGetTopToursByBookings,
];
