// src/controllers/authentication/change-password.ts
//
// POST /auth/change-password — the ONLY way to set or rotate a password once
// an account exists (profile updates carry no password, and admins never
// set passwords). Authenticated, works for BOTH principals; the conditional
// currentPassword rule (required when a password exists, forbidden for the
// passwordless first-set) lives in the service.
//
// On success the service bumps the session epoch — every OTHER session dies —
// and this controller immediately mints a fresh pair for the CALLER, so the
// session that changed the password stays signed in on new-epoch cookies.
import { Request, RequestHandler, Response } from 'express';

import {
  asyncHandler,
  UnauthorizedError,
} from '#middlewares/error-handler.js';
import zodValidation from '#middlewares/validate-request.js';
import {
  changePassword as changePasswordService,
  mintAuthTokens,
} from '#services/auth.service.js';
import { CookieManager } from '#utils/CookieManager.js';
import { sendSuccess } from '#utils/http-response.js';
import {
  ChangePasswordBody,
  changePasswordSchema,
} from '#validations/auth-validation.js';

const handleChangePassword = asyncHandler(
  async (req: Request, res: Response) => {
    const { user } = req;
    if (!user) {
      throw new UnauthorizedError('Unauthorized, no user provided');
    }
    const { currentPassword, newPassword } = req.body as ChangePasswordBody;

    // Returns the principal at its NEW session epoch (the bump killed every
    // already-issued token, including this request's own cookies).
    const principal = await changePasswordService(user.kind, user.id, {
      currentPassword,
      newPassword,
    });
    const tokens = await mintAuthTokens(principal);

    CookieManager.setAuthTokens(res, tokens);
    sendSuccess(res, { message: 'Password changed successfully.' });
  },
);

export const changePassword: RequestHandler[] = [
  ...zodValidation.body(changePasswordSchema),
  handleChangePassword,
];
