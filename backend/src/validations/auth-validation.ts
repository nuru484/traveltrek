// src/validations/auth-validation.ts
//
// Zod schemas for the authentication domain (replaces the express-validator
// chain in the legacy auth-validations.ts). Boundary rules only — shape,
// formats, enums. Notes on legacy fidelity:
//
// - registerUser is the MINIMAL public signup: name plus at least one contact
//   (email OR phone); password/address are optional — the profile is
//   completed later via PUT /users/:userId.
// - adminCreateUser keeps the stricter legacy requirements (address, email,
//   name) with only the password now optional (admin-created accounts can
//   OTP-login). `role` is read by the admin controller only.
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

// Read only by the admin create-user controller; public register forces
// CUSTOMER regardless of what was sent.
const roleField = z
  .enum(Role, 'role must be one of: ADMIN, CUSTOMER, AGENT')
  .optional();

export const loginSchema = z.object({
  email: z.email('Invalid email address'),
  password: z.string('Password is required').min(1, 'Password is required'),
});

/** Public minimal signup: name + (email OR phone); everything else optional. */
export const registerUserSchema = z
  .object({
    address: addressField.optional(),
    email: emailField.optional(),
    name: nameField,
    password: passwordField.optional(),
    phone: phoneField.optional(),
    profilePicture: z.string('profilePicture must be a string').optional(),
    role: roleField,
  })
  .refine((body) => Boolean(body.email ?? body.phone), {
    message: 'Provide an email address or a phone number',
    path: ['email'],
  });

/** Admin user creation: the legacy required fields, password now optional. */
export const adminCreateUserSchema = z.object({
  address: addressField,
  email: emailField,
  name: nameField,
  password: passwordField.optional(),
  phone: phoneField.optional(),
  profilePicture: z.string('profilePicture must be a string').optional(),
  role: roleField,
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

export type AdminCreateUserBody = z.infer<typeof adminCreateUserSchema>;
export type ForgotPasswordBody = z.infer<typeof forgotPasswordSchema>;
export type GoogleSignInBody = z.infer<typeof googleSignInSchema>;
export type LoginBody = z.infer<typeof loginSchema>;
export type OtpRequestBody = z.infer<typeof otpRequestSchema>;
export type OtpVerifyBody = z.infer<typeof otpVerifySchema>;
export type RegisterUserBody = z.infer<typeof registerUserSchema>;
export type ResetPasswordBody = z.infer<typeof resetPasswordSchema>;
