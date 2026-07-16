// src/validation/auth-validation.ts
//
// Form schemas for the auth surfaces. Each schema mirrors its backend
// counterpart in backend/src/validations/auth-validation.ts so the client
// enforces the same rules the server does.
import { z } from "zod";

const phoneRegex = /^\+?[0-9]{10,15}$/;

/** Mirrors backend `loginSchema` (password presence only — no strength leak). */
export const loginFormSchema = z.object({
  email: z.email("Email must be a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export type ILoginFormSchema = z.infer<typeof loginFormSchema>;

/**
 * Minimal public signup, mirroring backend `registerUserSchema`: a name plus
 * ONE contact channel (email or phone — the form toggles between them), and
 * an optional password. Passwordless accounts sign in via the emailed code.
 */
export const signupFormSchema = z
  .object({
    name: z
      .string()
      .min(1, "Name is required")
      .max(100, "Name must be 100 characters or less"),
    contactMethod: z.enum(["email", "phone"]),
    email: z
      .email("Email must be a valid email address")
      .max(255, "Email must be 255 characters or less")
      .or(z.literal(""))
      .optional(),
    phone: z
      .string()
      .refine((val) => phoneRegex.test(val), {
        message: "Phone must be a valid number (10-15 digits)",
      })
      .or(z.literal(""))
      .optional(),
    password: z
      .string()
      .min(4, "Password must be at least 4 characters")
      .max(255, "Password must be 255 characters or less")
      .or(z.literal(""))
      .optional(),
  })
  .refine(
    (data) =>
      data.contactMethod === "email" ? Boolean(data.email) : Boolean(data.phone),
    {
      message: "Provide an email or a phone number",
      path: ["email"],
    }
  );

export type ISignupFormSchema = z.infer<typeof signupFormSchema>;

/**
 * OTP login, step 1 (mirrors backend `otpRequestSchema`): a single contact
 * field that must read as an email address or a phone number — the submit
 * handler sends exactly one of {email} | {phone}.
 */
export const otpRequestFormSchema = z.object({
  contact: z
    .string()
    .min(1, "Enter your email or phone number")
    .refine(
      (val) => phoneRegex.test(val) || z.email().safeParse(val).success,
      { message: "Enter a valid email address or phone number" }
    ),
});

export type IOtpRequestFormSchema = z.infer<typeof otpRequestFormSchema>;

/** OTP login, step 2 (mirrors backend `otpVerifySchema` code rule). */
export const otpVerifyFormSchema = z.object({
  code: z
    .string()
    .regex(/^\d{6}$/, "Enter the 6-digit code we sent you"),
});

export type IOtpVerifyFormSchema = z.infer<typeof otpVerifyFormSchema>;

/** Mirrors backend `forgotPasswordSchema`. */
export const forgotPasswordFormSchema = z.object({
  email: z.email("Email must be a valid email address"),
});

export type IForgotPasswordFormSchema = z.infer<
  typeof forgotPasswordFormSchema
>;

/** Mirrors backend `resetPasswordSchema` password rule + a confirm field. */
export const resetPasswordFormSchema = z
  .object({
    password: z
      .string()
      .min(4, "Password must be at least 4 characters")
      .max(255, "Password must be 255 characters or less"),
    confirmPassword: z.string().min(1, "Confirm your new password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type IResetPasswordFormSchema = z.infer<typeof resetPasswordFormSchema>;

/**
 * Mirrors backend `changePasswordSchema` plus a confirm field. currentPassword
 * stays optional here: passwordless accounts (Google / OTP-only / staff-
 * created) set their FIRST password by leaving it blank — the backend 400s
 * with a clear message when the blank/filled choice doesn't match the account.
 */
export const changePasswordFormSchema = z
  .object({
    currentPassword: z
      .string()
      .max(255, "Current password must be 255 characters or less")
      .optional(),
    newPassword: z
      .string()
      .min(4, "Password must be at least 4 characters")
      .max(255, "Password must be 255 characters or less"),
    confirmPassword: z.string().min(1, "Confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type IChangePasswordFormSchema = z.infer<
  typeof changePasswordFormSchema
>;

/** The 6-digit code consumed by /auth/2fa/{verify,enable,disable} — the same
 * rule as the OTP login code (mirrors backend `twoFactorCodeSchema`). */
export const twoFactorCodeFormSchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code we sent you"),
});

export type ITwoFactorCodeFormSchema = z.infer<typeof twoFactorCodeFormSchema>;

/**
 * Secure contact changes (mirror backend `changeEmailSchema` /
 * `changePhoneSchema`): a new contact plus exactly ONE re-auth proof. The
 * form carries the chosen method and a single `secret` field; the submit
 * handler maps it onto {currentPassword} | {code} (contact-change-logic).
 */
const reauthProofRule = (
  data: { method: "password" | "code"; secret: string },
  ctx: z.RefinementCtx
) => {
  if (data.method === "password") {
    if (data.secret.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "Enter your current password",
        path: ["secret"],
      });
    }
  } else if (!/^\d{6}$/.test(data.secret)) {
    ctx.addIssue({
      code: "custom",
      message: "Enter the 6-digit code we sent you",
      path: ["secret"],
    });
  }
};

export const changeEmailFormSchema = z
  .object({
    newEmail: z
      .email("Email must be a valid email address")
      .max(255, "Email must be 255 characters or less"),
    method: z.enum(["password", "code"]),
    secret: z.string().max(255),
  })
  .superRefine(reauthProofRule);

export type IChangeEmailFormSchema = z.infer<typeof changeEmailFormSchema>;

export const changePhoneFormSchema = z
  .object({
    newPhone: z
      .string()
      .refine((val) => phoneRegex.test(val), {
        message: "Phone must be a valid number (10-15 digits)",
      }),
    method: z.enum(["password", "code"]),
    secret: z.string().max(255),
  })
  .superRefine(reauthProofRule);

export type IChangePhoneFormSchema = z.infer<typeof changePhoneFormSchema>;

/** Shared helper: split a contact string into the backend's email|phone pair. */
export const contactToPayload = (
  contact: string
): { email: string } | { phone: string } =>
  phoneRegex.test(contact) ? { phone: contact } : { email: contact };
