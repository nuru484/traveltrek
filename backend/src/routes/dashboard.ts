import { Router } from 'express';

import { getDashboardStats } from '#controllers/index.js';
import { authorizeRole } from '#middlewares/authorize-roles.js';
import { UserRole } from '#types/user-profile.types.js';

const dashboardRoutes = Router();

dashboardRoutes.get(
  '/dashboard',
  authorizeRole([UserRole.CUSTOMER, UserRole.ADMIN, UserRole.AGENT]),
  getDashboardStats,
);

export default dashboardRoutes;
