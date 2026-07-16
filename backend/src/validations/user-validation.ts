// src/validations/user-validation.ts
//
// Zod schemas for the user domain (replaces the express-validator chain in
// the legacy user-validations.ts). Boundary rules only — shape, formats,
// enums. Notes on legacy fidelity:
//
// - updateUserProfile mirrors the legacy chain field-for-field (name, email,
//   role, address, phone — all optional, same messages). `role` is validated
//   but IGNORED downstream, exactly as before: the legacy chain checked it
//   yet the handler never wrote it. password and profilePicture went
//   unvalidated in the legacy chain but the handler read them, so they are
//   declared with minimal typing to survive the parse (the Cloudinary
//   middleware overwrites profilePicture after parsing when a file is
//   uploaded).
// - changeUserRole: the legacy in-handler check ('Valid role is required')
//   moved here — same 400, now in the standard validation envelope.
// - list query: an invalid role FILTER was silently ignored by the legacy
//   handler (an includes() check), so `.catch(undefined)` preserves that.
// - deleteAllUsers has no schema: its confirmDelete gate stays in the service
//   so the exact legacy message and error shape survive.
import { z } from 'zod';

import { Role } from '#config/prismaClient.js';
import { paginationQuery } from '#validations/common-validation.js';

/** PUT /users/:userId — every field optional, legacy messages kept. */
export const updateUserProfileSchema = z.object({
  address: z
    .string('Address must be a string up to only 100 characters')
    .max(100, 'Address must be a string up to only 100 characters')
    .optional(),
  email: z
    .email('Invalid email address')
    .max(255, 'Invalid email address')
    .optional(),
  name: z
    .string('Name must be a string up to 100 characters')
    .max(100, 'Name must be a string up to 100 characters')
    .optional(),
  password: z.string('password must be a string').optional(),
  phone: z
    .string('Phone must be a valid phone number (10-15 digits)')
    .regex(
      /^\+?[0-9]{10,15}$/,
      'Phone must be a valid phone number (10-15 digits)',
    )
    .optional(),
  profilePicture: z.string('profilePicture must be a string').optional(),
  // Accepted (the legacy chain validated it) but nothing reads it.
  role: z
    .enum(Role, 'role must be one of: ADMIN, CUSTOMER, AGENT')
    .optional(),
});

/** PATCH /users/:userId/role — legacy in-handler message kept. */
export const changeUserRoleSchema = z.object({
  role: z.enum(Role, 'Valid role is required'),
});

/**
 * List filters for GET /users — an invalid role value falls back to undefined
 * (ignored), exactly as the legacy includes-check did.
 */
export const userListQuery = paginationQuery.extend({
  role: z.enum(Role).optional().catch(undefined),
  search: z.string().optional(),
});

export type ChangeUserRoleBody = z.infer<typeof changeUserRoleSchema>;
export type UpdateUserProfileBody = z.infer<typeof updateUserProfileSchema>;
export type UserListQueryInput = z.infer<typeof userListQuery>;
