import { Router } from 'express';
import {
  createDestination,
  getDestination,
  updateDestination,
  deleteDestination,
  getAllDestinations,
  deleteAllDestinations,
} from '../controllers/index';
import { authorizeRole } from '../middlewares/authorize-roles';
import { UserRole } from '../../types/user-profile.types';

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
