// src/utils/mappers/customer.mapper.ts
//
// Pure DTO mapper for the customer domain. Services return Prisma
// rows selected through `customerSelect`; controllers map them through here so
// the wire format lives in exactly one place and raw DB records never leak.
//
// The password (and the auth bookkeeping columns) are excluded at the SELECT,
// not stripped afterwards, so they can never appear in a DTO. Nullable
// columns map to undefined (dropped from the JSON), mirroring the user
// mapper's shape.
import type { BookingStatus, Prisma } from '#config/prismaClient.js';

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
 * lifetime activity stats (scoped to non-deleted rows by the service). */
export interface CustomerProfileDTO extends CustomerDTO {
  stats: {
    /** Mean COMPLETED payment, integer pesewas (totalSpent / completed
     * payment count, rounded); null when no payment has completed. */
    averageBookingValue: null | number;
    /** Lifetime booking count per status; statuses with zero bookings are
     * simply absent (e.g. `{ PENDING: 2, COMPLETED: 1 }`). */
    bookingsByStatus: Partial<Record<BookingStatus, number>>;
    /** The destination booked most often across tours, flights and hotel
     * rooms; ties go to the most recently booked one. Null with no bookings. */
    favoriteDestination: null | { id: number; name: string };
    /** createdAt of the most recent booking, or null with no bookings. */
    lastBookingAt: Date | null;
    /** Account creation instant — echoes createdAt so the stats block is
     * self-contained for profile widgets. */
    memberSince: Date;
    /** How the account came to exist: 'google' (googleId set), else 'email'
     * (email on file), else 'phone' (phone-only signup). */
    signupMethod: 'email' | 'google' | 'phone';
    /** Lifetime booking count, any status. */
    totalBookings: number;
    /** Lifetime payment count, any status (COMPLETED, PENDING, FAILED, ...). */
    totalPayments: number;
    /** Sum of COMPLETED payment amounts, integer pesewas (GH₵1.00 = 100). */
    totalSpent: number;
    /** PENDING/CONFIRMED bookings whose trip hasn't started yet (tour start /
     * room check-in / flight departure is still in the future). */
    upcomingTrips: number;
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
