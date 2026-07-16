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

/**
 * Password login on a 2FA-enabled account answers 200 with this payload
 * instead of a user DTO: no session cookies were issued — only the signed
 * pending cookie that gates POST /auth/2fa/{verify,resend}.
 */
export interface ITwoFactorRequiredData {
  twoFactorRequired: true;
}

/** POST /auth/login data: a full login DTO or the 2FA-pending marker. */
export type ILoginResponseData =
  | IUserRegistrationResponseData
  | ITwoFactorRequiredData;

export const isTwoFactorRequired = (
  data: ILoginResponseData
): data is ITwoFactorRequiredData =>
  "twoFactorRequired" in data && data.twoFactorRequired === true;

/**
 * POST /auth/change-password — currentPassword is required for accounts that
 * have a password and must be ABSENT for the passwordless first-set (the
 * backend 400s with a clear message when the rule is broken).
 */
export interface IChangePasswordInput {
  currentPassword?: string;
  newPassword: string;
}

export type TwoFactorChannel = "email" | "sms";

/** GET /auth/2fa/status — channel is where codes go (null: no email/phone). */
export interface ITwoFactorStatus {
  enabled: boolean;
  channel: TwoFactorChannel | null;
}

/** The 6-digit code bodies of /auth/2fa/{verify,enable,disable}. */
export interface ITwoFactorCodeInput {
  code: string;
}
