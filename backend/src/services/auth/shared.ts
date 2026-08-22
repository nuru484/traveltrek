// src/services/auth/shared.ts
//
// Shared, dependency-free building blocks for the auth service and its
// two-principal model (customers + staff Users). Constants, request/result
// types, the pure principal helpers, and the registration selects live here
// so every auth feature module and the core share one definition. No closure
// over the injected deps — those live in ./core and the feature modules.
import bcrypt from 'bcrypt';

import { BCRYPT_SALT_ROUNDS } from '#config/constants.js';
import {
  type Customer,
  type Prisma,
  type User,
} from '#config/prismaClient.js';
import { type AppDeps } from '#services/deps.js';
import { type PrincipalKind } from '#types/auth.types.js';
import { UserRole } from '#types/user-profile.types.js';
import { customerSelect } from '#utils/mappers/customer.mapper.js';
import { userSelect } from '#utils/mappers/user.mapper.js';

/**
 * A fixed bcrypt hash to compare against when an email doesn't exist, so the
 * login path spends the same time whether or not the account is real — closing
 * the timing side-channel that would otherwise leak which emails are registered.
 */
export const DUMMY_PASSWORD_HASH = bcrypt.hashSync(
  'enumeration-timing-guard',
  BCRYPT_SALT_ROUNDS,
);

/** After this many consecutive failed passwords, an account is briefly locked to
 * blunt per-account brute force (the per-IP limiter doesn't stop a botnet). */
export const MAX_FAILED_LOGINS = 5;
export const LOGIN_LOCK_MINUTES = 15;

/** Two overlapping tabs can race to exchange the same refresh cookie; a
 * replay this soon after consumption is that race, not theft, so it is
 * rejected without nuking the whole account. */
export const REFRESH_REUSE_GRACE_MS = 30_000;

/** OTP login codes: lifetime, wrong-guess cap per code, and the minimum gap
 * between two codes for the same account (the resend cooldown). */
export const OTP_TTL_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_SECONDS = 60;

/** Password-reset links are longer-lived than OTPs but still single-use. */
export const PASSWORD_RESET_TTL_MINUTES = 30;

/** Email-change confirmation links: same lifetime as reset links, single-use. */
export const EMAIL_CHANGE_TTL_MINUTES = 30;

/** Phone-change OTPs: same lifetime/attempt shape as login OTPs. */
export const PHONE_CHANGE_TTL_MINUTES = 10;
export const PHONE_CHANGE_MAX_ATTEMPTS = 5;

/** TWO_FACTOR codes: same lifetime/attempt/cooldown shape as OTP login codes.
 * The pending-cookie TTL (utils/two-factor-pending.ts) matches the code TTL. */
export const TWO_FACTOR_TTL_MINUTES = 10;
export const TWO_FACTOR_MAX_ATTEMPTS = 5;
export const TWO_FACTOR_RESEND_COOLDOWN_SECONDS = 60;

/** The account a login/refresh resolved — the controller picks the DTO and
 * mints tokens for whichever principal came back. */
export type AuthPrincipal =
  | { customer: Customer; kind: 'customer' }
  | { kind: 'staff'; user: User };

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/** POST /auth/change-email body. Re-auth proof: accounts WITH a password send
 * currentPassword; passwordless accounts send the code a prior
 * POST /auth/reauth/challenge delivered to their current contact. */
export interface ChangeEmailInput {
  code?: string;
  currentPassword?: string;
  newEmail: string;
}

/** POST /auth/change-password body, resolved against the authenticated actor. */
export interface ChangePasswordInput {
  /** Required when the account already has a password; must be ABSENT when it
   * is passwordless (this call then sets the first password). */
  currentPassword?: string;
  newPassword: string;
}

/** POST /auth/change-phone body — same re-auth proof rule as ChangeEmailInput. */
export interface ChangePhoneInput {
  code?: string;
  currentPassword?: string;
  newPhone: string;
}

/** The role a demo login asks for. ADMIN/AGENT resolve a staff User;
 * CUSTOMER resolves a Customer — the split-principal mirror of a real login. */
export type DemoRole = 'ADMIN' | 'AGENT' | 'CUSTOMER';

export interface LoginInput {
  email: string;
  password: string;
}

/**
 * What password login resolves to. When the principal has twoFactorEnabled,
 * NO session may be established yet: a TWO_FACTOR code has been sent and the
 * controller answers with `twoFactorRequired` plus the pending cookie instead
 * of auth cookies. Only /auth/2fa/verify completes the login.
 */
export interface LoginResult {
  principal: AuthPrincipal;
  twoFactorRequired: boolean;
}

/** How an OTP-login caller identifies the account — validation guarantees
 * exactly one of the two is present. */
export interface OtpContact {
  email?: string;
  phone?: string;
}

export interface RegisterInput {
  address?: string;
  /** Optional: phone-only signups have no email (name + email OR phone). */
  email?: string;
  name: string;
  /** Optional: passwordless accounts sign in via OTP (or Google) instead. */
  password?: string;
  phone?: string;
  /** Cloudinary URL, already uploaded by the route's middleware. */
  profilePicture?: string;
}

/** What mintAuthTokens needs to establish a session for either principal. */
export interface TokenPrincipal {
  id: number;
  kind: PrincipalKind;
  role: UserRole;
  tokenVersion: number;
}

/** Customers have no role column; they always present CUSTOMER on tokens so
 * the existing authorizeRole route gates keep working verbatim. */
export const customerPrincipal = (
  customer: Pick<Customer, 'id' | 'tokenVersion'>,
): TokenPrincipal => ({
  id: customer.id,
  kind: 'customer',
  role: UserRole.CUSTOMER,
  tokenVersion: customer.tokenVersion,
});

export const staffPrincipal = (
  user: Pick<User, 'id' | 'role' | 'tokenVersion'>,
): TokenPrincipal => ({
  id: user.id,
  kind: 'staff',
  role: user.role as UserRole,
  tokenVersion: user.tokenVersion,
});

export const toTokenPrincipal = (principal: AuthPrincipal): TokenPrincipal =>
  principal.kind === 'customer'
    ? customerPrincipal(principal.customer)
    : staffPrincipal(principal.user);

/** The auth-state columns customers and staff share (same names and types in
 * both tables), so the login/lockout logic runs once for either principal. */
export type AuthStateRow = Pick<
  User,
  | 'failedLoginAttempts'
  | 'id'
  | 'lockedUntil'
  | 'password'
  | 'tokenVersion'
  | 'twoFactorEnabled'
>;

export const authState = (principal: AuthPrincipal): AuthStateRow =>
  principal.kind === 'customer' ? principal.customer : principal.user;

/** The full row behind a principal (Customer and User share every column the
 * auth flows read — contact details, name, auth state). */
export const principalRow = (principal: AuthPrincipal): Customer | User =>
  principal.kind === 'customer' ? principal.customer : principal.user;

/**
 * The channel a principal's security codes travel over: email when one is on
 * file (durable, free), else SMS, else none — accounts with neither contact
 * cannot use code-based flows.
 */
export const twoFactorChannel = (row: {
  email: null | string;
  phone: null | string;
}): 'email' | 'sms' | null => (row.email ? 'email' : row.phone ? 'sms' : null);

export type AuthDeps = Pick<
  AppDeps,
  'clock' | 'config' | 'google' | 'logger' | 'notify' | 'prisma'
>;

/** GET /auth/2fa/status payload. */
export interface TwoFactorStatus {
  channel: 'email' | 'sms' | null;
  enabled: boolean;
}

/** The password-free customer shape plus tokenVersion, so the registration
 * controller can mint a session without a second read. */
export const registeredCustomerSelect = {
  ...customerSelect,
  tokenVersion: true,
} satisfies Prisma.CustomerSelect;

export type RegisteredCustomer = Prisma.CustomerGetPayload<{
  select: typeof registeredCustomerSelect;
}>;

/** Same idea for admin-created staff users. */
export const registeredUserSelect = {
  ...userSelect,
  tokenVersion: true,
} satisfies Prisma.UserSelect;

export type RegisteredUser = Prisma.UserGetPayload<{
  select: typeof registeredUserSelect;
}>;
