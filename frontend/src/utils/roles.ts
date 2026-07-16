// src/utils/roles.ts
//
// Role gating for the split-principal auth model: staff sessions (User table)
// carry role ADMIN | AGENT, customer sessions (Customer table) have NO role
// field. A missing role therefore always means CUSTOMER.
import type { IAuthUser } from "@/types/auth";
import type { UserRole } from "@/types/user.types";

export const isAdmin = (user?: IAuthUser | null): boolean =>
  user?.role === "ADMIN";

export const isAgent = (user?: IAuthUser | null): boolean =>
  user?.role === "AGENT";

/** ADMIN or AGENT — the only principals with a role field. */
export const isStaff = (user?: IAuthUser | null): boolean =>
  user?.role === "ADMIN" || user?.role === "AGENT";

/** A logged-in principal without a staff role is a customer. */
export const isCustomer = (user?: IAuthUser | null): boolean =>
  Boolean(user) && !isStaff(user);

/** Effective role for display/branching; missing role reads as CUSTOMER. */
export const roleOf = (user?: IAuthUser | null): UserRole =>
  user?.role ?? "CUSTOMER";
