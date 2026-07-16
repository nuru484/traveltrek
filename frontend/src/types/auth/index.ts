import { UserRole } from "../user.types";

/**
 * The authenticated principal stored in auth state. Staff sessions (User
 * table) carry a role; customer sessions (Customer table) have NO role field
 * — role-gating treats a missing role as CUSTOMER.
 */
export interface IUserRegistrationResponseData {
  id: number;
  name: string;
  /** Absent for phone-only signups. */
  email?: string;
  /** Present for staff (ADMIN | AGENT); absent for customers. */
  role?: UserRole;
  phone?: string;
  address?: string;
  profilePicture?: string;
  createdAt: string;
  updatedAt: string;
}

export type IAuthUser = IUserRegistrationResponseData;

// --- Auth mutation payloads (mirror backend src/validations/auth-validation.ts) ---

/** POST /auth/otp/request — exactly one of email or phone. */
export interface IOtpRequestInput {
  email?: string;
  phone?: string;
}

/** POST /auth/otp/verify — the contact plus the 6-digit code. */
export interface IOtpVerifyInput {
  email?: string;
  phone?: string;
  code: string;
}

export interface IForgotPasswordInput {
  email: string;
}

export interface IResetPasswordInput {
  token: string;
  password: string;
}

export interface IGoogleSignInInput {
  idToken: string;
}
