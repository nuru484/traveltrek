import { Router } from 'express';

import {
  createTour,
  deleteTour,
  getAllTours,
  getTour,
  updateTour,
  updateTourStatus,
} from '#controllers/index.js';
import { authorizeRole } from '#middlewares/authorize-roles.js';
import { UserRole } from '#types/user-profile.types.js';

const tourRoutes = Router();

tourRoutes.post('/tours', authorizeRole([UserRole.ADMIN]), ...createTour);

tourRoutes.get(
  '/tours/:id',
  authorizeRole([UserRole.ADMIN, UserRole.AGENT, UserRole.CUSTOMER]),
  ...getTour,
);

tourRoutes.patch(
  '/tours/:id/status',
  authorizeRole([UserRole.ADMIN]),
  ...updateTourStatus,
);

tourRoutes.put('/tours/:id', authorizeRole([UserRole.ADMIN]), ...updateTour);

tourRoutes.delete('/tours/:id', authorizeRole([UserRole.ADMIN]), ...deleteTour);

tourRoutes.get(
  '/tours',
  authorizeRole([UserRole.ADMIN, UserRole.AGENT, UserRole.CUSTOMER]),
  ...getAllTours,
);

export default tourRoutes;
