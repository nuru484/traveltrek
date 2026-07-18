// src/types/user.ts
//
// /users is STAFF-ONLY (backend Phase 5b): every User row is an ADMIN or
// AGENT account. Customers are a separate principal under /customers.
import type { ReactNode } from "react";
export type UserRole = "ADMIN" | "CUSTOMER" | "AGENT";

/** The only roles a User row may carry (customers are not users anymore). */
export type StaffRole = "ADMIN" | "AGENT";

/** Mirrors backend UserDTO (src/utils/mappers/user.mapper.ts). */
export interface IUser {
  id: number;
  name: string;
  /** Absent for phone-only accounts. */
  email?: string;
  role: StaffRole;
  phone?: string;
  profilePicture?: string;
  address?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IUserResponse {
  message: string;
  data: IUser;
}

export interface IUsersPaginatedResponse {
  message: string;
  data: IUser[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/** PUT /users/:userId - no password field (a `password` key is stripped);
 * passwords rotate only through POST /auth/change-password. */
export interface IUserUpdateInput {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  profilePicture?: string;
}

/** PATCH /users/:userId/role - staff-only enum on the backend. */
export interface IChangeRoleInput {
  role: StaffRole;
}

export interface IUsersQueryParams {
  page?: number;
  limit?: number;
  role?: StaffRole;
  search?: string;
}

export interface IUsersDataTableProps {
  data: IUser[];
  loading?: boolean;
  totalCount?: number;
  page?: number;
  pageSize?: number;
  filters: Omit<IUsersQueryParams, "page" | "limit">;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  onFiltersChange: (
    filters: Partial<Omit<IUsersQueryParams, "page" | "limit">>
  ) => void;
  onRefresh?: () => void;
  /** Page actions (e.g. Add Staff) rendered inside the toolbar. */
  toolbarActions?: ReactNode;
}
