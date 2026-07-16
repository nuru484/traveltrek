// src/validation/customer-validation.ts
//
// Form schemas for the customers section. Mirrors backend
// backend/src/validations/customer-validation.ts:
// - create: name + at least one contact (email OR phone); password/address optional.
// - update: every field optional (empty strings are simply not sent).
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

const passwordField = z
  .string()
  .min(4, "Password must be at least 4 characters")
  .max(255, "Password must be 255 characters or less")
  .or(z.literal(""))
  .optional();

/** Mirrors backend `createCustomerSchema` (JSON create; no picture upload). */
export const customerCreateFormSchema = z
  .object({
    name: nameField,
    email: emailField,
    phone: phoneField,
    address: addressField,
    password: passwordField,
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
  password: passwordField,
  profilePicture: z.instanceof(File).optional(),
});

export type ICustomerUpdateFormSchema = z.infer<
  typeof customerUpdateFormSchema
>;
