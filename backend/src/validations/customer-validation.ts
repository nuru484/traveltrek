// src/validations/customer-validation.ts
//
// Zod schemas for the customers domain (Phase 5b). Boundary rules only —
// shape, formats — mirroring the user-domain field rules so the two profile
// surfaces validate identically:
//
// - createCustomer is the staff-side minimal creation: name plus at least one
//   contact (email OR phone), password/address optional — the same rule the
//   public signup enforces.
// - updateCustomer mirrors updateUserProfile field-for-field (no role — a
//   customer has none).
// - list query: pagination + a free-text search across name/email/phone.
import { z } from 'zod';

import { paginationQuery } from '#validations/common-validation.js';

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

/** POST /customers — minimal: name + (email OR phone), the rest optional. */
export const createCustomerSchema = z
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

/** PUT /customers/:id — every field optional. */
export const updateCustomerSchema = z.object({
  address: addressField.optional(),
  email: emailField.optional(),
  name: nameField.optional(),
  password: passwordField.optional(),
  phone: phoneField.optional(),
  profilePicture: z.string('profilePicture must be a string').optional(),
});

/** List filters for GET /customers. */
export const customerListQuery = paginationQuery.extend({
  search: z.string().optional(),
});

/** History pagination for GET /customers/:id/{bookings,payments}. */
export const customerHistoryQuery = paginationQuery;

export type CreateCustomerBody = z.infer<typeof createCustomerSchema>;
export type CustomerHistoryQueryInput = z.infer<typeof customerHistoryQuery>;
export type CustomerListQueryInput = z.infer<typeof customerListQuery>;
export type UpdateCustomerBody = z.infer<typeof updateCustomerSchema>;
