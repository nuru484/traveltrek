import { Router } from 'express';

import {
  cancelBooking,
  createBooking,
  deleteAllBookings,
  deleteBooking,
  getAllBookings,
  getBooking,
  getCustomerBookings,
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

// Customer self-cancellation (staff may cancel any booking through it too) —
// the own-booking rule lives in the service.
bookingRoutes.post(
  '/bookings/:id/cancel',
  authorizeRole([UserRole.ADMIN, UserRole.AGENT, UserRole.CUSTOMER]),
  cancelBooking,
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

// Phase 5b: bookings hang off Customers — the old /bookings/user/:userId
// path is REMOVED (not aliased).
bookingRoutes.get(
  '/bookings/customer/:customerId',
  authorizeRole([UserRole.ADMIN, UserRole.AGENT, UserRole.CUSTOMER]),
  getCustomerBookings,
);

bookingRoutes.delete(
  '/bookings',
  authorizeRole([UserRole.ADMIN]),
  deleteAllBookings,
);

export default bookingRoutes;
