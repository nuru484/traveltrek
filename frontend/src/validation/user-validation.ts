// src/validation/user-validation.ts
//
// Form schemas for the STAFF section (/users is staff-only on the backend).
// Mirrors backend backend/src/validations/auth-validation.ts
// `adminCreateUserSchema` (create: name/email/address required, role required
// and restricted to ADMIN | AGENT) and
// backend/src/validations/user-validation.ts `updateUserProfileSchema`
// (edit: everything optional). NO password on either surface — the backend
// strips a `password` key; accounts start passwordless and their owner sets
// one via POST /auth/change-password (or forgot-password).
import { z } from "zod";

const phoneRegex = /^\+?[0-9]{10,15}$/;

const nameField = z
  .string()
  .min(1, "Full name is required")
  .max(100, "Name must be 100 characters or less");

const emailField = z
  .email("Email must be a valid email address")
  .max(255, "Email must be 255 characters or less");

const phoneField = z
  .string()
  .refine((val) => phoneRegex.test(val), {
    message: "Phone must be a valid number (10-15 digits)",
  })
  .or(z.literal(""))
  .optional();

export const staffRoleEnum = z.enum(["ADMIN", "AGENT"]);

/** Admin creates STAFF only: role is required, ADMIN | AGENT. */
export const staffCreateFormSchema = z.object({
  name: nameField,
  email: emailField,
  role: staffRoleEnum,
  address: z
    .string()
    .min(1, "Address is required")
    .max(100, "Address must be 100 characters or less"),
  phone: phoneField,
  profilePicture: z.instanceof(File).optional(),
});

export type IStaffCreateFormSchema = z.infer<typeof staffCreateFormSchema>;

/** PUT /users/:userId — every field optional on the backend. */
export const staffUpdateFormSchema = z.object({
  name: nameField,
  email: emailField,
  address: z
    .string()
    .max(100, "Address must be 100 characters or less")
    .or(z.literal(""))
    .optional(),
  phone: phoneField,
  profilePicture: z.instanceof(File).optional(),
});

export type IStaffUpdateFormSchema = z.infer<typeof staffUpdateFormSchema>;
