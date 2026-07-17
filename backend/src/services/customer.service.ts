// src/services/customer.service.ts
//
// Thin composer for the customers domain (Phase 5b: customers are a separate
// principal from staff, so an admin can open a customer profile and see the
// full identity plus the complete booking/payment history). The implementation
// is split into modules under ./customer: shared.ts (types, the self-or-staff
// predicate), core.ts (picture cleanup, contact-uniqueness pre-check, the
// scoped existence read), write.service.ts (create/update/delete), and
// profile.service.ts (list, the FULL profile + stats, the histories).
// makeCustomerService builds the core once and spreads each feature factory
// into one object, preserving the public surface.
import { makeCustomerCore } from '#services/customer/core.js';
import { makeCustomerProfileService } from '#services/customer/profile.service.js';
import {
  type CustomerActor,
  type CustomerCreateInput,
  type CustomerDeleteSummary,
  type CustomerDeps,
  type CustomerListParams,
  type CustomerProfile,
  type CustomerProfileStats,
  type CustomerUpdateInput,
  type HistoryParams,
} from '#services/customer/shared.js';
import { makeCustomerWriteService } from '#services/customer/write.service.js';
import { defaultDeps } from '#services/deps.js';

// Re-export the public types controllers/tests import from this module path
// (unchanged from the pre-split surface).
export {
  type CustomerActor,
  type CustomerCreateInput,
  type CustomerDeleteSummary,
  type CustomerListParams,
  type CustomerProfile,
  type CustomerProfileStats,
  type CustomerUpdateInput,
  type HistoryParams,
};

export const makeCustomerService = (d: CustomerDeps) => {
  const core = makeCustomerCore(d);
  return {
    ...makeCustomerWriteService(d, core),
    ...makeCustomerProfileService(d, core),
  };
};

export const customerService = makeCustomerService(defaultDeps);

export const {
  createCustomer,
  deleteCustomer,
  getCustomerById,
  listCustomerBookingHistory,
  listCustomerPaymentHistory,
  listCustomers,
  updateCustomer,
} = customerService;
