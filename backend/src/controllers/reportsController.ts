// src/controllers/reportsController.ts
//
// Thin HTTP adapters for the reports domain: each export is a RequestHandler
// bundle of [zod query validation, asyncHandler(handler)]. Handlers read the
// typed req.query the middleware wrote back (numbers coerced, defaults for
// currency/limit/minBookings applied), call the report service, and reply
// through the standard envelope helpers. All aggregate math and Prisma
// access lives in services/report.service.ts, whose `data` payload goes out
// as-is, including the `summary.period` / `filters` echoes the frontend
// dashboards read.
//
// Routes gate all three endpoints to ADMIN; no handler re-checks the actor.
import { Request, RequestHandler, Response } from 'express';

import {
  asyncHandler,
  UnauthorizedError,
} from '#middlewares/error-handler.js';
import zodValidation from '#middlewares/validate-request.js';
import {
  getAgentActivity as getAgentActivityService,
  getCustomerSelfReport,
  getMonthlyBookingsSummary as getMonthlyBookingsSummaryService,
  getPaymentsSummary as getPaymentsSummaryService,
  getTopToursByBookings as getTopToursByBookingsService,
} from '#services/report.service.js';
import { sendSuccess } from '#utils/http-response.js';
import { toBookingDTO } from '#utils/mappers/booking.mapper.js';
import {
  agentActivityQuery,
  AgentActivityQueryInput,
  monthlyBookingsQuery,
  MonthlyBookingsQueryInput,
  paymentsSummaryQuery,
  PaymentsSummaryQueryInput,
  selfReportQuery,
  SelfReportQueryInput,
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

// GET /reports/me — route-gated to CUSTOMER, so the actor id is a customer
// id; the service scopes every read to it.
const handleGetMyReport = asyncHandler(
  async (req: Request, res: Response) => {
    const { user } = req;
    if (!user) throw new UnauthorizedError('Unauthorized, no user provided');

    const query = req.query as unknown as SelfReportQueryInput;
    const report = await getCustomerSelfReport(user.id, query);

    sendSuccess(res, {
      data: {
        ...report,
        recentBookings: report.recentBookings.map(toBookingDTO),
      },
      message: 'Your travel report retrieved successfully',
    });
  },
);
export const getMyReport: RequestHandler[] = [
  ...zodValidation.query(selfReportQuery),
  handleGetMyReport,
];

// GET /reports/agent-activity — ADMIN/AGENT; the agents-only-themselves /
// admin ?userId= override rule lives in the service.
const handleGetAgentActivity = asyncHandler(
  async (req: Request, res: Response) => {
    const { user } = req;
    if (!user) throw new UnauthorizedError('Unauthorized, no user provided');

    const query = req.query as unknown as AgentActivityQueryInput;
    const report = await getAgentActivityService(
      { id: user.id, role: user.role },
      query,
    );

    sendSuccess(res, {
      data: {
        ...report,
        recentBookings: report.recentBookings.map(toBookingDTO),
      },
      message: 'Agent activity report retrieved successfully',
    });
  },
);
export const getAgentActivity: RequestHandler[] = [
  ...zodValidation.query(agentActivityQuery),
  handleGetAgentActivity,
];
