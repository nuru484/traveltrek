// src/validations/auth-validation.ts
//
// Zod schemas for the authentication domain (replaces the express-validator
// chain in the legacy auth-validations.ts). Boundary rules only — shape,
// formats, enums. Notes on legacy fidelity:
//
// - registerUser is the MINIMAL public signup: name plus at least one contact
//   (email OR phone); password/address are optional — the profile is
//   completed later via PUT /customers/:id. Public signups always create a
//   Customer (Phase 5b).
// - adminCreateUser creates STAFF ONLY: the legacy required fields (address,
//   email, name) and role required + restricted to ADMIN | AGENT. No
//   password — accounts start passwordless (see the schema note).
// - profilePicture is declared minimally: the Cloudinary middleware
//   overwrites it after parsing when a file is uploaded.
// - login/otp/reset only check presence/shape — password strength is enforced
//   where a password is set, and auth errors must not leak which rule failed.
import { z } from 'zod';

import { Role } from '#config/prismaClient.js';

const addressField = z
  .string('Address must be a string up to 100 characters')
  .max(100, 'Address must be a string up to 100 characters');

const emailField = z
  .email('Invalid email address')
  .max(255, 'Invalid email address');

const nameField = z
  .string('Name can only be a string up to 100 characters')
  .max(100, 'Name can only be a string up to 100 characters');

const passwordField = z
  .string('Password must be a strong password')
  .min(4, 'Password must be at least 4 characters long')
  .max(255, 'Password must be a strong password');

const phoneField = z
  .string('Phone must be a valid phone number (10-15 digits)')
  .regex(
    /^\+?[0-9]{10,15}$/,
    'Phone must be a valid phone number (10-15 digits)',
  );

// POST /users creates STAFF ONLY (Phase 5b): customers are a separate model
// created via public signup or POST /customers, so the role is required here
// and restricted to the staff roles.
const staffRoleField = z.enum(
  [Role.ADMIN, Role.AGENT],
  'role must be one of: ADMIN, AGENT',
);

export const loginSchema = z.object({
  email: z.email('Invalid email address'),
  password: z.string('Password is required').min(1, 'Password is required'),
});

/** POST /auth/demo-login — the role to sign in as. ADMIN/AGENT resolve a
 * staff User; CUSTOMER resolves a Customer. Server-gated by DEMO_LOGIN_ENABLED;
 * the demo accounts themselves live in the DB (no credentials cross the wire). */
export const demoLoginSchema = z.object({
  role: z.enum(
    ['ADMIN', 'AGENT', 'CUSTOMER'],
    'role must be one of: ADMIN, AGENT, CUSTOMER',
  ),
});

/** Public minimal signup: name + (email OR phone); everything else optional.
 * Creates a CUSTOMER — there is no role concept on the public surface (a
 * `role` key in the body is simply stripped). */
export const registerUserSchema = z
  .object({
    address: addressField.optional(),
    email: emailField.optional(),
    name: nameField,
    password: passwordField.optional(),
    phone: phoneField.optional(),
    profilePicture: z.string('profilePicture must be a string').optional(),
  })
  .refine((body) => Boolean(body.email ?? body.phone), {
    message: 'Provide an email address or a phone number',
    path: ['email'],
  });

/** Admin STAFF creation: the legacy required fields and the role mandatory +
 * staff-only (ADMIN | AGENT). NO password — admins never set one (a `password`
 * key in the body is simply stripped): the account starts passwordless and
 * its owner establishes a password via forgot-password. */
export const adminCreateUserSchema = z.object({
  address: addressField,
  email: emailField,
  name: nameField,
  phone: phoneField.optional(),
  profilePicture: z.string('profilePicture must be a string').optional(),
  role: staffRoleField,
});

/** OTP login identifies the account by exactly ONE of email or phone. */
const otpContactRule = (body: { email?: string; phone?: string }): boolean =>
  Boolean(body.email) !== Boolean(body.phone);

export const otpRequestSchema = z
  .object({
    email: emailField.optional(),
    phone: phoneField.optional(),
  })
  .refine(otpContactRule, {
    message: 'Provide exactly one of email or phone',
    path: ['email'],
  });

export const otpVerifySchema = z
  .object({
    code: z
      .string('Code must be the 6-digit number we sent you')
      .regex(/^\d{6}$/, 'Code must be the 6-digit number we sent you'),
    email: emailField.optional(),
    phone: phoneField.optional(),
  })
  .refine(otpContactRule, {
    message: 'Provide exactly one of email or phone',
    path: ['email'],
  });

export const forgotPasswordSchema = z.object({
  email: z.email('Invalid email address'),
});

export const resetPasswordSchema = z.object({
  password: passwordField,
  token: z.string('Reset token is required').min(1, 'Reset token is required'),
});

export const googleSignInSchema = z.object({
  idToken: z.string('idToken is required').min(1, 'idToken is required'),
});

/** POST /auth/change-password — currentPassword is conditionally required
 * (accounts WITH a password) / forbidden (passwordless first-set); that rule
 * depends on DB state, so it lives in the service, not here. */
export const changePasswordSchema = z.object({
  currentPassword: z
    .string('currentPassword must be a string')
    .min(1, 'currentPassword must not be empty')
    .max(255, 'currentPassword must not be empty')
    .optional(),
  newPassword: passwordField,
});

const codeField = z
  .string('Code must be the 6-digit number we sent you')
  .regex(/^\d{6}$/, 'Code must be the 6-digit number we sent you');

/** The 6-digit code bodies of /auth/2fa/{verify,enable,disable} — the same
 * shape OTP login verifies. */
export const twoFactorCodeSchema = z.object({
  code: codeField,
});

/** Contact changes re-authenticate with exactly ONE proof: currentPassword
 * (accounts with a password) or the code POST /auth/reauth/challenge sent
 * (passwordless accounts). Which one an account must use is DB state, so the
 * service enforces the pairing; the boundary only requires exactly one. */
const reauthProofRule = (body: {
  code?: string;
  currentPassword?: string;
}): boolean => Boolean(body.currentPassword) !== Boolean(body.code);

/** POST /auth/change-email — parks the new address; a confirmation link goes
 * to the NEW address (see auth.service.requestEmailChange). */
export const changeEmailSchema = z
  .object({
    code: codeField.optional(),
    currentPassword: z
      .string('currentPassword must be a string')
      .min(1, 'currentPassword must not be empty')
      .max(255, 'currentPassword must not be empty')
      .optional(),
    newEmail: emailField,
  })
  .refine(reauthProofRule, {
    message: 'Provide exactly one of currentPassword or code',
    path: ['currentPassword'],
  });

/** POST /auth/change-phone — parks the new number; an OTP goes to the NEW
 * phone (see auth.service.requestPhoneChange). */
export const changePhoneSchema = z
  .object({
    code: codeField.optional(),
    currentPassword: z
      .string('currentPassword must be a string')
      .min(1, 'currentPassword must not be empty')
      .max(255, 'currentPassword must not be empty')
      .optional(),
    newPhone: phoneField,
  })
  .refine(reauthProofRule, {
    message: 'Provide exactly one of currentPassword or code',
    path: ['currentPassword'],
  });

/** POST /auth/confirm-email-change — the emailed link token (unauthenticated,
 * like reset-password: the token IS the credential). */
export const confirmEmailChangeSchema = z.object({
  token: z
    .string('Confirmation token is required')
    .min(1, 'Confirmation token is required'),
});

/** POST /auth/confirm-phone-change — the 6-digit code texted to the NEW phone. */
export const confirmPhoneChangeSchema = z.object({
  code: codeField,
});

export type AdminCreateUserBody = z.infer<typeof adminCreateUserSchema>;
export type ChangeEmailBody = z.infer<typeof changeEmailSchema>;
export type ChangePasswordBody = z.infer<typeof changePasswordSchema>;
export type ChangePhoneBody = z.infer<typeof changePhoneSchema>;
export type ConfirmEmailChangeBody = z.infer<typeof confirmEmailChangeSchema>;
export type ConfirmPhoneChangeBody = z.infer<typeof confirmPhoneChangeSchema>;
export type DemoLoginBody = z.infer<typeof demoLoginSchema>;
export type ForgotPasswordBody = z.infer<typeof forgotPasswordSchema>;
export type GoogleSignInBody = z.infer<typeof googleSignInSchema>;
export type LoginBody = z.infer<typeof loginSchema>;
export type OtpRequestBody = z.infer<typeof otpRequestSchema>;
export type OtpVerifyBody = z.infer<typeof otpVerifySchema>;
export type RegisterUserBody = z.infer<typeof registerUserSchema>;
export type ResetPasswordBody = z.infer<typeof resetPasswordSchema>;
export type TwoFactorCodeBody = z.infer<typeof twoFactorCodeSchema>;
