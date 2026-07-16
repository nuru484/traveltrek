// src/utils/mappers/customer.mapper.ts
//
// Pure DTO mapper for the customer domain (Phase 5b). Services return Prisma
// rows selected through `customerSelect`; controllers map them through here so
// the wire format lives in exactly one place and raw DB records never leak.
//
// The password (and the auth bookkeeping columns) are excluded at the SELECT,
// not stripped afterwards, so they can never appear in a DTO. Nullable
// columns map to undefined (dropped from the JSON), mirroring the user
// mapper's shape.
import type { Prisma } from '#config/prismaClient.js';

/** Every customer column except password/auth internals. */
export const customerSelect = {
  address: true,
  createdAt: true,
  email: true,
  id: true,
  name: true,
  phone: true,
  profilePicture: true,
  updatedAt: true,
} satisfies Prisma.CustomerSelect;

export interface CustomerDTO {
  address?: string;
  createdAt: Date;
  /** Absent for phone-only signups (nullable column, dropped from the JSON). */
  email?: string;
  id: number;
  name: string;
  phone?: string;
  profilePicture?: string;
  updatedAt: Date;
}

/** The full-profile shape GET /customers/:id returns: the base DTO plus
 * lifetime activity counters (scoped to non-deleted rows by the service). */
export interface CustomerProfileDTO extends CustomerDTO {
  stats: {
    totalBookings: number;
    totalPayments: number;
  };
}

export type SafeCustomer = Prisma.CustomerGetPayload<{
  select: typeof customerSelect;
}>;

export const toCustomerDTO = (customer: SafeCustomer): CustomerDTO => ({
  address: customer.address ?? undefined,
  createdAt: customer.createdAt,
  email: customer.email ?? undefined,
  id: customer.id,
  name: customer.name,
  phone: customer.phone ?? undefined,
  profilePicture: customer.profilePicture ?? undefined,
  updatedAt: customer.updatedAt,
});

export const toCustomerProfileDTO = (
  customer: SafeCustomer,
  stats: CustomerProfileDTO['stats'],
): CustomerProfileDTO => ({
  ...toCustomerDTO(customer),
  stats,
});
