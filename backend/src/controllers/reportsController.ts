// src/controllers/reportsController.ts
import { NextFunction, Request, RequestHandler, Response } from 'express';
import {
  IMonthlyBookingsResponse,
  IPaymentsSummaryResponse,
  IReportsQueryParams,
  ITopToursResponse,
} from 'types/reports.types';

import { HTTP_STATUS_CODES } from '../config/constants';
import prisma from '../config/prismaClient';
import { asyncHandler } from '../middlewares/error-handler';
import validationMiddleware from '../middlewares/validation';
import {
  monthlyBookingsValidation,
  paymentsSummaryValidation,
  topToursValidation,
} from '../validations/reports-validations';

const handleGetMonthlyBookingsSummary = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const {
      endDate,
      month,
      startDate,
      status,
      tourId,
      userId,
      year = new Date().getFullYear(),
    }: IReportsQueryParams = req.query;

    let dateFilter: any = {};

    if (startDate && endDate) {
      dateFilter = {
        bookingDate: {
          gte: new Date(startDate),
          lte: new Date(endDate),
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
      select: {
        bookingDate: true,
        id: true,
        status: true,
        totalPrice: true,
        tour: {
          select: {
            id: true,
            name: true,
          },
        },
        user: {
          select: {
            email: true,
            id: true,
            name: true,
          },
        },
      },
      where,
    });

    const totalBookings = bookings.length;
    const totalRevenue = bookings.reduce(
      (sum, booking) => sum + booking.totalPrice,
      0,
    );
    const averageBookingValue =
      totalBookings > 0 ? totalRevenue / totalBookings : 0;

    const monthlyBreakdown = bookings.reduce<any>((acc, booking) => {
      const monthKey = booking.bookingDate.toISOString().slice(0, 7);

      if (!acc[monthKey]) {
        acc[monthKey] = {
          averageValue: 0,
          bookingCount: 0,
          month: monthKey,
          revenue: 0,
        };
      }

      acc[monthKey].bookingCount += 1;
      acc[monthKey].revenue += booking.totalPrice;
      acc[monthKey].averageValue =
        acc[monthKey].revenue / acc[monthKey].bookingCount;

      return acc;
    }, {});

    const statusBreakdown = bookings.reduce<any>((acc, booking) => {
      acc[booking.status] = (acc[booking.status] || 0) + 1;
      return acc;
    }, {});

    const response: IMonthlyBookingsResponse = {
      data: {
        bookings: bookings.slice(0, 10),
        monthlyBreakdown: Object.values(monthlyBreakdown),
        statusBreakdown,
        summary: {
          averageBookingValue: Math.round(averageBookingValue * 100) / 100,
          period: {
            endDate: endDate!,
            month: month ? Number(month) : null,
            startDate: startDate!,
            year: Number(year),
          },
          totalBookings,
          totalRevenue,
        },
      },
      message: 'Monthly bookings summary retrieved successfully',
    };

    res.status(HTTP_STATUS_CODES.OK).json(response);
  },
);

export const getMonthlyBookingsSummary: RequestHandler[] = [
  ...validationMiddleware.create(monthlyBookingsValidation),
  handleGetMonthlyBookingsSummary,
];

const handleGetPaymentsSummary = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const {
      currency = 'GHS',
      endDate,
      month,
      paymentMethod,
      startDate,
      status,
      userId,
      year = new Date().getFullYear(),
    }: IReportsQueryParams = req.query;

    let dateFilter: any = {};

    if (startDate && endDate) {
      dateFilter = {
        paymentDate: {
          gte: new Date(startDate),
          lte: new Date(endDate),
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
      select: {
        amount: true,
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
        currency: true,
        id: true,
        paymentDate: true,
        paymentMethod: true,
        status: true,
        transactionReference: true,
        user: {
          select: {
            email: true,
            id: true,
            name: true,
          },
        },
      },
      where,
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

    const statusBreakdown = payments.reduce<any>((acc, payment) => {
      if (!acc[payment.status]) {
        acc[payment.status] = {
          amount: 0,
          count: 0,
        };
      }
      acc[payment.status].count += 1;
      acc[payment.status].amount += payment.amount;
      return acc;
    }, {});

    const methodBreakdown = payments.reduce<any>((acc, payment) => {
      if (!acc[payment.paymentMethod]) {
        acc[payment.paymentMethod] = {
          amount: 0,
          count: 0,
        };
      }
      acc[payment.paymentMethod].count += 1;
      acc[payment.paymentMethod].amount += payment.amount;
      return acc;
    }, {});

    // Monthly breakdown
    const monthlyBreakdown = payments.reduce<any>((acc, payment) => {
      if (!payment.paymentDate) return acc;

      const monthKey = payment.paymentDate.toISOString().slice(0, 7);

      if (!acc[monthKey]) {
        acc[monthKey] = {
          count: 0,
          month: monthKey,
          revenue: 0,
        };
      }

      acc[monthKey].count += 1;
      if (payment.status === 'COMPLETED') {
        acc[monthKey].revenue += payment.amount;
      }

      return acc;
    }, {});

    const response: IPaymentsSummaryResponse = {
      data: {
        methodBreakdown,
        monthlyBreakdown: Object.values(monthlyBreakdown),
        recentPayments: payments
          .sort(
            (a, b) =>
              (b.paymentDate?.getTime() || 0) - (a.paymentDate?.getTime() || 0),
          )
          .slice(0, 10),
        statusBreakdown,
        summary: {
          currency: currency,
          failedAmount,
          pendingAmount,
          period: {
            endDate: endDate!,
            month: month ? Number(month) : null,
            startDate: startDate!,
            year: Number(year),
          },
          refundedAmount,
          totalPayments,
          totalRevenue,
        },
      },
      message: 'Payments summary retrieved successfully',
    };

    res.status(HTTP_STATUS_CODES.OK).json(response);
  },
);

export const getPaymentsSummary: RequestHandler[] = [
  ...validationMiddleware.create(paymentsSummaryValidation),
  handleGetPaymentsSummary,
];

const handleGetTopToursByBookings = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const {
      endDate,
      limit = 5,
      minBookings = 1,
      month,
      startDate,
      tourStatus,
      tourType,
      year = new Date().getFullYear(),
    }: IReportsQueryParams = req.query;

    let bookingDateFilter: any = {};

    if (startDate && endDate) {
      bookingDateFilter = {
        bookingDate: {
          gte: new Date(startDate),
          lte: new Date(endDate),
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
      select: {
        bookings: {
          select: {
            bookingDate: true,
            id: true,
            status: true,
            totalPrice: true,
          },
          where: bookingDateFilter,
        },
        description: true,
        destination: {
          select: {
            city: true,
            country: true,
            id: true,
            name: true,
          },
        },
        duration: true,
        endDate: true,
        id: true,
        maxGuests: true,
        name: true,
        price: true,
        startDate: true,
        status: true,
        type: true,
      },
      where: tourWhere,
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

        return {
          statistics: {
            confirmedBookings,
            totalBookings,
            totalRevenue,
          },
          tour: {
            description: tour.description,
            destination: tour.destination,
            duration: tour.duration,
            endDate: tour.endDate,
            id: tour.id,
            maxGuests: tour.maxGuests,
            name: tour.name,
            price: tour.price,
            startDate: tour.startDate,
            status: tour.status,
            type: tour.type,
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
      data: {
        summary: {
          filters: {
            limit: Number(limit),
            minBookings: Number(minBookings),
            tourStatus: tourStatus,
            tourType: tourType,
          },
          period: {
            endDate: endDate!,
            month: month ? Number(month) : null,
            startDate: startDate!,
            year: Number(year),
          },
          totalBookingsAnalyzed,
          totalRevenueAnalyzed,
          totalToursAnalyzed,
        },
        topTours: tourStats,
      },
      message: `Top ${tourStats.length} tours by booking count retrieved successfully`,
    };

    res.status(HTTP_STATUS_CODES.OK).json(response);
  },
);

export const getTopToursByBookings: RequestHandler[] = [
  ...validationMiddleware.create(topToursValidation),
  handleGetTopToursByBookings,
];
