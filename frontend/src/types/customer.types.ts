// src/types/customer.types.ts
//
// Customers are their own principal: bookings/payments hang off a Customer
// record, and customers have NO role field. The DTO
// shapes mirror backend src/utils/mappers/customer.mapper.ts.
import type { ReactNode } from "react";
import type { BookingStatus } from "./booking.types";

export interface ICustomer {
  id: number;
  name: string;
  /** Absent for phone-only signups. */
  email?: string;
  phone?: string;
  address?: string;
  profilePicture?: string;
  createdAt: string;
  updatedAt: string;
}

/** How the account came to exist (derived by the profile service). */
export type CustomerSignupMethod = "email" | "google" | "phone";

/**
 * GET /customers/:id returns the base DTO plus the lifetime activity stats
 * block (mirrors backend CustomerProfileDTO in customer.mapper.ts). All
 * money figures are integer pesewas.
 */
export interface ICustomerProfile extends ICustomer {
  stats: {
    /** Mean COMPLETED payment (pesewas); null when none has completed. */
    averageBookingValue: number | null;
    /** Lifetime booking count per status; zero-count statuses are absent. */
    bookingsByStatus: Partial<Record<BookingStatus, number>>;
    /** Most-booked destination; null with no bookings. */
    favoriteDestination: { id: number; name: string } | null;
    /** createdAt of the most recent booking; null with no bookings. */
    lastBookingAt: string | null;
    /** Account creation instant (echoes createdAt). */
    memberSince: string;
    signupMethod: CustomerSignupMethod;
    totalBookings: number;
    totalPayments: number;
    /** Sum of COMPLETED payment amounts (pesewas). */
    totalSpent: number;
    /** PENDING/CONFIRMED bookings whose trip hasn't started yet. */
    upcomingTrips: number;
  };
}

export interface ICustomerResponse {
  message: string;
  data: ICustomer;
}

export interface ICustomerProfileResponse {
  message: string;
  data: ICustomerProfile;
}

export interface ICustomersPaginatedResponse {
  message: string;
  data: ICustomer[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/** Mirrors backend customerListQuery (page/limit + free-text search). */
export interface ICustomersQueryParams {
  page?: number;
  limit?: number;
  search?: string;
}

/** Mirrors backend customerHistoryQuery (pagination only). */
export interface ICustomerHistoryQueryParams {
  page?: number;
  limit?: number;
}

/** POST /customers is JSON (no upload middleware on the create route). No
 * password - staff never set one; owners use POST /auth/change-password. */
export interface ICustomerCreateInput {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

export interface IDeleteCustomerResponse {
  message: string;
}

export interface ICustomersDataTableProps {
  data: ICustomer[];
  loading?: boolean;
  totalCount?: number;
  page?: number;
  pageSize?: number;
  filters: Omit<ICustomersQueryParams, "page" | "limit">;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  onFiltersChange: (
    filters: Partial<Omit<ICustomersQueryParams, "page" | "limit">>
  ) => void;
  onRefresh?: () => void;
  /** Page actions (e.g. Add Customer) rendered inside the toolbar. */
  toolbarActions?: ReactNode;
}
