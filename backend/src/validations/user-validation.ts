// src/validations/user-validation.ts
//
// Zod schemas for the user domain (replaces the express-validator chain in
// the legacy user-validations.ts). Boundary rules only — shape, formats,
// enums. Notes on legacy fidelity:
//
// - updateUserProfile mirrors the legacy chain field-for-field (name, email,
//   role, address, phone — all optional, same messages). `role` is validated
//   but IGNORED downstream, exactly as before: the legacy chain checked it
//   yet the handler never wrote it. `password` is GONE from this surface —
//   passwords rotate only through POST /auth/change-password. profilePicture
//   is declared with minimal typing to survive the parse (the Cloudinary
//   middleware overwrites it after parsing when a file is uploaded).
// - changeUserRole: the legacy in-handler check ('Valid role is required')
//   moved here — same 400, now in the standard validation envelope.
// - list query: an invalid role FILTER was silently ignored by the legacy
//   handler (an includes() check), so `.catch(undefined)` preserves that.
import { z } from 'zod';

import { Role } from '#config/prismaClient.js';
import { paginationQuery } from '#validations/common-validation.js';

/** PUT /users/:userId — every field optional, legacy messages kept. NO
 * password (a `password` key in the body is simply stripped): passwords
 * rotate only through the authenticated POST /auth/change-password, so a
 * staff session can never overwrite another account's credential.
 *
 * email/phone stay in the schema for edits of OTHER accounts (administrative
 * override, cross-principal-checked in the service), but a staff member
 * editing their OWN profile may not change them here: zod cannot know the
 * actor, so the service 400s a self-service change and points at the
 * verified flows (POST /auth/change-email / /auth/change-phone). */
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
    .enum(Role, 'role must be one of: ADMIN, AGENT')
    .optional(),
});

/** PATCH /users/:userId/role — legacy in-handler message kept. Staff-only
 * (Phase 5b): no User row may become a CUSTOMER — customers are a separate
 * model. */
export const changeUserRoleSchema = z.object({
  role: z.enum([Role.ADMIN, Role.AGENT], 'Valid role is required'),
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
