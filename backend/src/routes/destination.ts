import { Router } from 'express';

import {
  createDestination,
  deleteAllDestinations,
  deleteDestination,
  getAllDestinations,
  getDestination,
  updateDestination,
} from '#controllers/index.js';
import { authorizeRole } from '#middlewares/authorize-roles.js';
import { UserRole } from '#types/user-profile.types.js';

const destinationRoutes = Router();

destinationRoutes.post(
  '/destinations',
  authorizeRole([UserRole.ADMIN]),
  createDestination,
);

destinationRoutes.get(
  '/destinations/:id',
  authorizeRole([UserRole.ADMIN, UserRole.AGENT, UserRole.CUSTOMER]),
  getDestination,
);

destinationRoutes.put(
  '/destinations/:id',
  authorizeRole([UserRole.ADMIN]),
  updateDestination,
);

destinationRoutes.delete(
  '/destinations/:id',
  authorizeRole([UserRole.ADMIN]),
  deleteDestination,
);

destinationRoutes.get(
  '/destinations',
  authorizeRole([UserRole.ADMIN, UserRole.AGENT, UserRole.CUSTOMER]),
  getAllDestinations,
);

destinationRoutes.delete(
  '/destinations',
  authorizeRole([UserRole.ADMIN]),
  deleteAllDestinations,
);

export default destinationRoutes;
