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

tourRoutes.delete('/tours', authorizeRole([UserRole.ADMIN]), deleteAllTours);

export default tourRoutes;
