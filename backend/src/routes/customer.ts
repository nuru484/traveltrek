// src/routes/customer.ts
//
// Customers domain. Staff (ADMIN/AGENT) manage the customer base;
// the CUSTOMER role passes the per-record gates so customers can reach their
// OWN profile/history — the self-vs-others rule is enforced in the service.
import { Router } from 'express';

import {
  createCustomer,
  deleteCustomer,
  getAllCustomers,
  getCustomerBookingHistory,
  getCustomerById,
  getCustomerPaymentHistory,
  updateCustomer,
} from '#controllers/index.js';
import { authorizeRole } from '#middlewares/authorize-roles.js';
import { UserRole } from '#types/user-profile.types.js';

const customerRoutes = Router();

customerRoutes.get(
  '/customers',
  authorizeRole([UserRole.ADMIN, UserRole.AGENT]),
  ...getAllCustomers,
);

customerRoutes.post(
  '/customers',
  authorizeRole([UserRole.ADMIN, UserRole.AGENT]),
  ...createCustomer,
);

customerRoutes.get(
  '/customers/:id',
  authorizeRole([UserRole.ADMIN, UserRole.AGENT, UserRole.CUSTOMER]),
  ...getCustomerById,
);

customerRoutes.get(
  '/customers/:id/bookings',
  authorizeRole([UserRole.ADMIN, UserRole.AGENT, UserRole.CUSTOMER]),
  ...getCustomerBookingHistory,
);

customerRoutes.get(
  '/customers/:id/payments',
  authorizeRole([UserRole.ADMIN, UserRole.AGENT, UserRole.CUSTOMER]),
  ...getCustomerPaymentHistory,
);

customerRoutes.put(
  '/customers/:id',
  authorizeRole([UserRole.ADMIN, UserRole.AGENT, UserRole.CUSTOMER]),
  ...updateCustomer,
);

customerRoutes.delete(
  '/customers/:id',
  authorizeRole([UserRole.ADMIN]),
  ...deleteCustomer,
);

export default customerRoutes;
