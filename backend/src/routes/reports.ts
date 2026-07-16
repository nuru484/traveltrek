// src/routes/reports.ts
import { Router } from 'express';

import {
  getAgentActivity,
  getMonthlyBookingsSummary,
  getMyReport,
  getPaymentsSummary,
  getTopToursByBookings,
} from '#controllers/index.js';
import { authorizeRole } from '#middlewares/authorize-roles.js';
import { UserRole } from '#types/user-profile.types.js';

const reportsRoutes = Router();

// Per-role self reports. /me is CUSTOMER-only (staff have no customer id);
// /agent-activity is staff-only, with agents pinned to themselves in the
// service (ADMIN may pass ?userId=). The admin dashboards below stay ADMIN.
reportsRoutes.get(
  '/reports/me',
  authorizeRole([UserRole.CUSTOMER]),
  getMyReport,
);

reportsRoutes.get(
  '/reports/agent-activity',
  authorizeRole([UserRole.ADMIN, UserRole.AGENT]),
  getAgentActivity,
);

reportsRoutes.get(
  '/reports/bookings/monthly-summary',
  authorizeRole([UserRole.ADMIN]),
  getMonthlyBookingsSummary,
);

reportsRoutes.get(
  '/reports/payments/summary',
  authorizeRole([UserRole.ADMIN]),
  getPaymentsSummary,
);

reportsRoutes.get(
  '/reports/tours/top-by-bookings',
  authorizeRole([UserRole.ADMIN]),
  getTopToursByBookings,
);

export default reportsRoutes;
