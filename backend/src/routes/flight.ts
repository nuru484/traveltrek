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

// Create a new flight
flightRoutes.post('/flights', createFlight);

// Get a single flight by ID
flightRoutes.get('/flights/:id', getFlight);

flightRoutes.patch('/flights/:id/status', updateFlightStatus);

// Update a flight by ID
flightRoutes.put('/flights/:id', updateFlight);

// Delete a flight by ID
flightRoutes.delete('/flights/:id', deleteFlight);

// Get all flights
flightRoutes.get('/flights', getAllFlights);

// Delete all flights
flightRoutes.delete(
  '/flights',
  authorizeRole([UserRole.ADMIN]),
  deleteAllFlights,
);

export default flightRoutes;
