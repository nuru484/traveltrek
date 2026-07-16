import { Router } from 'express';

import {
  createBooking,
  deleteAllBookings,
  deleteBooking,
  getAllBookings,
  getBooking,
  getUserBookings,
  updateBooking,
} from '#controllers/index.js';
import { authorizeRole } from '#middlewares/authorize-roles.js';
import { UserRole } from '#types/user-profile.types.js';

const bookingRoutes = Router();

bookingRoutes.post(
  '/bookings',
  authorizeRole([UserRole.ADMIN, UserRole.AGENT, UserRole.CUSTOMER]),
  createBooking,
);

bookingRoutes.get(
  '/bookings/:id',
  authorizeRole([UserRole.ADMIN, UserRole.AGENT, UserRole.CUSTOMER]),
  getBooking,
);

bookingRoutes.put(
  '/bookings/:id',
  authorizeRole([UserRole.ADMIN, UserRole.AGENT, UserRole.CUSTOMER]),
  updateBooking,
);

bookingRoutes.delete(
  '/bookings/:id',
  authorizeRole([UserRole.ADMIN]),
  deleteBooking,
);

bookingRoutes.get(
  '/bookings',
  authorizeRole([UserRole.ADMIN, UserRole.AGENT, UserRole.CUSTOMER]),
  getAllBookings,
);

bookingRoutes.get(
  '/bookings/user/:userId',
  authorizeRole([UserRole.ADMIN, UserRole.AGENT, UserRole.CUSTOMER]),
  getUserBookings,
);

bookingRoutes.delete(
  '/bookings',
  authorizeRole([UserRole.ADMIN]),
  deleteAllBookings,
);

export default bookingRoutes;
