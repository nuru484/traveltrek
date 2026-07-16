// src/validation/customer-validation.ts
//
// Form schemas for the customers section. Mirrors backend
// backend/src/validations/customer-validation.ts:
// - create: name + at least one contact (email OR phone); address optional.
// - update: every field optional (empty strings are simply not sent).
// NO password on either surface — staff never set a customer's password
// (the backend strips a `password` key); owners use POST /auth/change-password.
import { z } from "zod";

const phoneRegex = /^\+?[0-9]{10,15}$/;

const nameField = z
  .string()
  .min(1, "Name is required")
  .max(100, "Name must be 100 characters or less");

const emailField = z
  .email("Email must be a valid email address")
  .max(255, "Email must be 255 characters or less")
  .or(z.literal(""))
  .optional();

const phoneField = z
  .string()
  .refine((val) => phoneRegex.test(val), {
    message: "Phone must be a valid number (10-15 digits)",
  })
  .or(z.literal(""))
  .optional();

const addressField = z
  .string()
  .max(100, "Address must be 100 characters or less")
  .or(z.literal(""))
  .optional();

/** Mirrors backend `createCustomerSchema` (JSON create; no picture upload). */
export const customerCreateFormSchema = z
  .object({
    name: nameField,
    email: emailField,
    phone: phoneField,
    address: addressField,
  })
  .refine((data) => Boolean(data.email) || Boolean(data.phone), {
    message: "Provide an email or a phone number",
    path: ["email"],
  });

export type ICustomerCreateFormSchema = z.infer<
  typeof customerCreateFormSchema
>;

/** Mirrors backend `updateCustomerSchema` — every field optional. */
export const customerUpdateFormSchema = z.object({
  name: nameField,
  email: emailField,
  phone: phoneField,
  address: addressField,
  profilePicture: z.instanceof(File).optional(),
});

export type ICustomerUpdateFormSchema = z.infer<
  typeof customerUpdateFormSchema
>;
