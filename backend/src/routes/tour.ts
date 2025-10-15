import { Router } from 'express';
import {
  createTour,
  getTour,
  updateTour,
  deleteTour,
  getAllTours,
  deleteAllTours,
  updateTourStatus,
} from '../controllers/index';
import { authorizeRole } from '../middlewares/authorize-roles';
import { UserRole } from '../../types/user-profile.types';

const tourRoutes = Router();

// Create a new tour
tourRoutes.post('/tours', authorizeRole([UserRole.ADMIN]), ...createTour);

// Get a single tour by ID
tourRoutes.get(
  '/tours/:id',
  authorizeRole([UserRole.ADMIN, UserRole.AGENT, UserRole.CUSTOMER]),
  ...getTour,
);

// Update a tour status
tourRoutes.patch(
  '/tours/:id/status',
  authorizeRole([UserRole.ADMIN]),
  ...updateTourStatus,
);

// Update a tour by ID
tourRoutes.put('/tours/:id', authorizeRole([UserRole.ADMIN]), ...updateTour);

// Delete a tour by ID
tourRoutes.delete('/tours/:id', authorizeRole([UserRole.ADMIN]), ...deleteTour);

// Get all tours
tourRoutes.get(
  '/tours',
  authorizeRole([UserRole.ADMIN, UserRole.AGENT, UserRole.CUSTOMER]),
  ...getAllTours,
);

// Delete all tours
tourRoutes.delete('/tours', authorizeRole([UserRole.ADMIN]), deleteAllTours);

export default tourRoutes;
