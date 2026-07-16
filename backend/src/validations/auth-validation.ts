// src/validations/auth-validation.ts
//
// Zod schemas for the authentication domain (replaces the express-validator
// chain in the legacy auth-validations.ts). Boundary rules only — shape,
// formats, enums. Notes on legacy fidelity:
//
// - register mirrors the legacy chain (name/password/address required with
//   the same messages and limits, phone optional with the same pattern) and
//   adds what the legacy chain forgot: the email itself. `role` is accepted
//   so the admin create-user route can read it — the PUBLIC register
//   controller ignores it and always forces CUSTOMER.
// - profilePicture is declared minimally: the Cloudinary middleware
//   overwrites it after parsing when a file is uploaded.
// - login only checks presence/shape — password strength is enforced where a
//   password is set, and login must not leak which rule failed.
import { z } from 'zod';

import { Role } from '#config/prismaClient.js';

export const loginSchema = z.object({
  email: z.email('Invalid email address'),
  password: z.string('Password is required').min(1, 'Password is required'),
});

export const registerUserSchema = z.object({
  address: z
    .string('Address must be a string up to 100 characters')
    .max(100, 'Address must be a string up to 100 characters'),
  email: z.email('Invalid email address').max(255, 'Invalid email address'),
  name: z
    .string('Name can only be a string up to 100 characters')
    .max(100, 'Name can only be a string up to 100 characters'),
  password: z
    .string('Password must be a strong password')
    .min(4, 'Password must be at least 4 characters long')
    .max(255, 'Password must be a strong password'),
  phone: z
    .string('Phone must be a valid phone number (10-15 digits)')
    .regex(
      /^\+?[0-9]{10,15}$/,
      'Phone must be a valid phone number (10-15 digits)',
    )
    .optional(),
  profilePicture: z.string('profilePicture must be a string').optional(),
  // Read only by the admin create-user controller; public register forces
  // CUSTOMER regardless of what was sent.
  role: z.enum(Role, 'role must be one of: ADMIN, CUSTOMER, AGENT').optional(),
});

export type LoginBody = z.infer<typeof loginSchema>;
export type RegisterUserBody = z.infer<typeof registerUserSchema>;
