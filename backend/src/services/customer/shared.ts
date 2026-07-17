// src/services/customer/shared.ts
//
// Dependency-free building blocks for the customers domain (Phase 5b: a
// customer is a separate principal from staff): the request/result types and
// the self-or-staff authorization predicate. Shared by the customer core and
// every feature module.
import { type BookingStatus } from '#config/prismaClient.js';
import { type AppDeps } from '#services/deps.js';
import { type PrincipalKind } from '#types/auth.types.js';
import { UserRole } from '#types/user-profile.types.js';
import { type SafeCustomer } from '#utils/mappers/customer.mapper.js';

export interface CustomerActor {
  id: number;
  kind: PrincipalKind;
  role: UserRole;
}

/** NO password: staff-created customers start passwordless (OTP login /
 * forgot-password establish one) — the zod schema strips any sent value. */
export interface CustomerCreateInput {
  address?: string;
  email?: string;
  name: string;
  phone?: string;
  profilePicture?: string;
}

export interface CustomerDeleteSummary {
  /** Null for phone-only accounts (email is a nullable column). */
  email: null | string;
  name: string;
}

/** The deps the customers domain draws from the app container. */
export type CustomerDeps = Pick<
  AppDeps,
  'clock' | 'cloudinary' | 'logger' | 'prisma'
>;

export interface CustomerListParams {
  limit: number;
  page: number;
  search?: string;
}

export interface CustomerProfile {
  customer: SafeCustomer;
  stats: CustomerProfileStats;
}

/** The lifetime-activity block of GET /customers/:id — see the mapper
 * (CustomerProfileDTO) for the per-field wire documentation. */
export interface CustomerProfileStats {
  averageBookingValue: null | number;
  bookingsByStatus: Partial<Record<BookingStatus, number>>;
  favoriteDestination: null | { id: number; name: string };
  lastBookingAt: Date | null;
  memberSince: Date;
  signupMethod: 'email' | 'google' | 'phone';
  totalBookings: number;
  totalPayments: number;
  totalSpent: number;
  upcomingTrips: number;
}

/** NO password: profile updates never touch credentials — passwords rotate
 * only through the authenticated POST /auth/change-password. */
export interface CustomerUpdateInput {
  address?: string;
  email?: string;
  name?: string;
  phone?: string;
  /** Cloudinary URL, already uploaded by the route's middleware. */
  profilePicture?: string;
}

export interface HistoryParams {
  limit: number;
  page: number;
}

/** May the actor read/write this customer? Self (a CUSTOMER principal with
 * the same id) always; ADMIN/AGENT staff anyone. */
export const canTouchCustomer = (
  actor: CustomerActor,
  customerId: number,
): boolean =>
  (actor.kind === 'customer' && actor.id === customerId) ||
  actor.role === UserRole.ADMIN ||
  actor.role === UserRole.AGENT;
