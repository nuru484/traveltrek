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

export const userRoleSchema = z.enum(["ADMIN", "CUSTOMER", "AGENT"]);

export const signupFormSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be 100 characters or less"),
  email: z.email("Email must be a valid email address"),
  password: z
    .string()
    .min(4, "Password must be at least 5 characters")
    .max(255, "Password must be 255 characters or less"),
  role: userRoleSchema.refine((val) => val !== "ADMIN", {
    message: "Role must be AGENT or CUSTOMER",
  }),
  phone: z
    .string()
    .nonempty("Phone is required")
    .refine((val) => /^\+?[0-9]{10,15}$/.test(val), {
      message: "Phone must be a valid number (10–15 digits)",
    }),
  address: z
    .string()
    .max(255, "Address must be 255 characters or less")
    .optional(),
  profilePicture: z.file().optional(),
});

export type ISignupFormSchema = z.infer<typeof signupFormSchema>;
