import { Router } from 'express';
import {
  createFlight,
  getFlight,
  updateFlight,
  deleteFlight,
  getAllFlights,
  deleteAllFlights,
  updateFlightStatus,
} from '../controllers/index';
import { authorizeRole } from '../middlewares/authorize-roles';
import { UserRole } from '../../types/user-profile.types';

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
