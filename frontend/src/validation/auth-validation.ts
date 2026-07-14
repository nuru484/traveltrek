// src/validation/auth-validation.ts
import { z } from "zod";

export const loginFormSchema = z.object({
  email: z.email("Email must be a valid email address"),
  password: z
    .string()
    .min(4, "Password must be at least 4 characters")
    .max(255, "Password must be 255 characters or less"),
});

export type ILoginFormSchema = z.infer<typeof loginFormSchema>;

/**
 * Minimal signup: a name plus at least one contact channel (email or phone).
 * The system will send a default password to that channel, and the user
 * completes their profile inside the app (backend support to follow).
 */
export const signupFormSchema = z
  .object({
    name: z
      .string()
      .min(1, "Name is required")
      .max(100, "Name must be 100 characters or less"),
    email: z
      .email("Email must be a valid email address")
      .or(z.literal(""))
      .optional(),
    phone: z
      .string()
      .refine((val) => /^\+?[0-9]{10,15}$/.test(val), {
        message: "Phone must be a valid number (10–15 digits)",
      })
      .or(z.literal(""))
      .optional(),
  })
  .refine((data) => Boolean(data.email) || Boolean(data.phone), {
    message: "Provide an email or a phone number",
    path: ["email"],
  });

export type ISignupFormSchema = z.infer<typeof signupFormSchema>;
