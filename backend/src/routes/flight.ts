import { Router } from 'express';

import { UserRole } from '../../types/user-profile.types';
import {
  createFlight,
  deleteAllFlights,
  deleteFlight,
  getAllFlights,
  getFlight,
  updateFlight,
  updateFlightStatus,
} from '../controllers/index';
import { authorizeRole } from '../middlewares/authorize-roles';

const flightRoutes = Router();

flightRoutes.post('/flights', authorizeRole([UserRole.ADMIN]), createFlight);

flightRoutes.get(
  '/flights/:id',
  authorizeRole([UserRole.ADMIN, UserRole.AGENT, UserRole.CUSTOMER]),
  getFlight,
);

flightRoutes.patch(
  '/flights/:id/status',
  authorizeRole([UserRole.ADMIN]),
  updateFlightStatus,
);

flightRoutes.put('/flights/:id', authorizeRole([UserRole.ADMIN]), updateFlight);

flightRoutes.delete(
  '/flights/:id',
  authorizeRole([UserRole.ADMIN]),
  deleteFlight,
);

flightRoutes.get(
  '/flights',
  authorizeRole([UserRole.ADMIN, UserRole.AGENT, UserRole.CUSTOMER]),
  getAllFlights,
);

flightRoutes.delete(
  '/flights',
  authorizeRole([UserRole.ADMIN]),
  deleteAllFlights,
);

export default flightRoutes;
