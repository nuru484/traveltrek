import { Router } from 'express';

import { getDashboardStats, getNeedsAttention } from '#controllers/index.js';
import { authorizeRole } from '#middlewares/authorize-roles.js';
import { UserRole } from '#types/user-profile.types.js';

const dashboardRoutes = Router();

dashboardRoutes.get(
  '/dashboard',
  authorizeRole([UserRole.CUSTOMER, UserRole.ADMIN, UserRole.AGENT]),
  getDashboardStats,
);

// Staff-only: the counts expose bookings/payments operations data.
dashboardRoutes.get(
  '/dashboard/needs-attention',
  authorizeRole([UserRole.ADMIN, UserRole.AGENT]),
  getNeedsAttention,
);

export default dashboardRoutes;
