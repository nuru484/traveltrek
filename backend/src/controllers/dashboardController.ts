// src/controllers/dashboardController.ts
//
// Thin HTTP adapter for the dashboard domain: a single RequestHandler bundle
// wrapping asyncHandler(handler). The handler passes the authenticated
// actor's role to the dashboard service (which widens the stats for
// ADMIN/AGENT) and replies through the standard envelope helper. All Prisma
// counts/aggregates live in services/dashboard.service.ts.
import { Request, RequestHandler, Response } from 'express';

import { asyncHandler } from '#middlewares/error-handler.js';
import { getDashboardStats as getDashboardStatsService } from '#services/dashboard.service.js';
import { sendSuccess } from '#utils/http-response.js';

const handleGetDashboardStats = asyncHandler(
  async (req: Request, res: Response) => {
    const data = await getDashboardStatsService(req.user?.role);

    sendSuccess(res, {
      data,
      message: 'Dashboard statistics retrieved successfully',
    });
  },
);
export const getDashboardStats: RequestHandler[] = [handleGetDashboardStats];
