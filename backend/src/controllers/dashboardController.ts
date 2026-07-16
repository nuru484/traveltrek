// src/controllers/dashboardController.ts
//
// Thin HTTP adapters for the dashboard domain: RequestHandler bundles
// wrapping asyncHandler(handler). The stats handler passes the authenticated
// actor's role to the dashboard service (which widens the stats for
// ADMIN/AGENT); needs-attention takes no input (the route gates it to
// staff). Both reply through the standard envelope helper. All Prisma
// counts/aggregates live in services/dashboard.service.ts.
import { Request, RequestHandler, Response } from 'express';

import { asyncHandler } from '#middlewares/error-handler.js';
import {
  getDashboardStats as getDashboardStatsService,
  getNeedsAttention as getNeedsAttentionService,
} from '#services/dashboard.service.js';
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

const handleGetNeedsAttention = asyncHandler(
  async (_req: Request, res: Response) => {
    const data = await getNeedsAttentionService();

    sendSuccess(res, {
      data,
      message: 'Needs-attention summary retrieved successfully',
    });
  },
);
export const getNeedsAttention: RequestHandler[] = [handleGetNeedsAttention];
