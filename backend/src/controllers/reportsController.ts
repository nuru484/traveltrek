// src/controllers/reportsController.ts
//
// Thin HTTP adapters for the reports domain: each export is a RequestHandler
// bundle of [zod query validation, asyncHandler(handler)]. Handlers read the
// typed req.query the middleware wrote back (numbers coerced, defaults for
// currency/limit/minBookings applied), call the report service, and reply
// through the standard envelope helpers. All aggregate math and Prisma
// access lives in services/report.service.ts, which returns the legacy
// `data` payload unchanged — including the `summary.period` / `filters`
// echoes the frontend dashboards read.
//
// Routes gate all three endpoints to ADMIN, as before; no in-handler actor
// rules existed in the legacy controller.
import { Request, RequestHandler, Response } from 'express';

import { asyncHandler } from '#middlewares/error-handler.js';
import zodValidation from '#middlewares/validate-request.js';
import {
  getMonthlyBookingsSummary as getMonthlyBookingsSummaryService,
  getPaymentsSummary as getPaymentsSummaryService,
  getTopToursByBookings as getTopToursByBookingsService,
} from '#services/report.service.js';
import { sendSuccess } from '#utils/http-response.js';
import {
  monthlyBookingsQuery,
  MonthlyBookingsQueryInput,
  paymentsSummaryQuery,
  PaymentsSummaryQueryInput,
  topToursQuery,
  TopToursQueryInput,
} from '#validations/report-validation.js';

const handleGetMonthlyBookingsSummary = asyncHandler(
  async (req: Request, res: Response) => {
    const query = req.query as unknown as MonthlyBookingsQueryInput;
    const data = await getMonthlyBookingsSummaryService(query);

    sendSuccess(res, {
      data,
      message: 'Monthly bookings summary retrieved successfully',
    });
  },
);
export const getMonthlyBookingsSummary: RequestHandler[] = [
  ...zodValidation.query(monthlyBookingsQuery),
  handleGetMonthlyBookingsSummary,
];

const handleGetPaymentsSummary = asyncHandler(
  async (req: Request, res: Response) => {
    const query = req.query as unknown as PaymentsSummaryQueryInput;
    const data = await getPaymentsSummaryService(query);

    sendSuccess(res, {
      data,
      message: 'Payments summary retrieved successfully',
    });
  },
);
export const getPaymentsSummary: RequestHandler[] = [
  ...zodValidation.query(paymentsSummaryQuery),
  handleGetPaymentsSummary,
];

const handleGetTopToursByBookings = asyncHandler(
  async (req: Request, res: Response) => {
    const query = req.query as unknown as TopToursQueryInput;
    const data = await getTopToursByBookingsService(query);

    sendSuccess(res, {
      data,
      message: `Top ${data.topTours.length} tours by booking count retrieved successfully`,
    });
  },
);
export const getTopToursByBookings: RequestHandler[] = [
  ...zodValidation.query(topToursQuery),
  handleGetTopToursByBookings,
];
