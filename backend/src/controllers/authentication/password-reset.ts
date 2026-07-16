// src/controllers/authentication/password-reset.ts
//
// Thin bundles over the auth service's forgot/reset password flow. The forgot
// step replies with the SAME 200 whether or not the email has an account (no
// enumeration); the reset step consumes the emailed single-use token, sets
// the new password and kills every live session (tokenVersion bump) — the
// user signs in again with the new password.
import { Request, RequestHandler, Response } from 'express';

import { asyncHandler } from '#middlewares/error-handler.js';
import zodValidation from '#middlewares/validate-request.js';
import {
  requestPasswordReset as requestPasswordResetService,
  resetPassword as resetPasswordService,
} from '#services/auth.service.js';
import { sendSuccess } from '#utils/http-response.js';
import {
  ForgotPasswordBody,
  forgotPasswordSchema,
  ResetPasswordBody,
  resetPasswordSchema,
} from '#validations/auth-validation.js';

const handleForgotPassword = asyncHandler(
  async (req: Request, res: Response) => {
    const { email } = req.body as ForgotPasswordBody;

    await requestPasswordResetService(email);

    // One fixed message for known and unknown emails alike.
    sendSuccess(res, {
      message:
        'If an account exists for that email, a password reset link is on its way.',
    });
  },
);

const handleResetPassword = asyncHandler(
  async (req: Request, res: Response) => {
    const { password, token } = req.body as ResetPasswordBody;

    await resetPasswordService(token, password);

    sendSuccess(res, {
      message:
        'Your password has been reset. Please log in with your new password.',
    });
  },
);

export const forgotPassword: RequestHandler[] = [
  ...zodValidation.body(forgotPasswordSchema),
  handleForgotPassword,
];

export const resetPassword: RequestHandler[] = [
  ...zodValidation.body(resetPasswordSchema),
  handleResetPassword,
];
