// src/routes/reports.ts
import { Router } from 'express';

import {
  getMonthlyBookingsSummary,
  getPaymentsSummary,
  getTopToursByBookings,
} from '#controllers/index.js';
import { authorizeRole } from '#middlewares/authorize-roles.js';
import { UserRole } from '#types/user-profile.types.js';

const reportsRoutes = Router();

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
