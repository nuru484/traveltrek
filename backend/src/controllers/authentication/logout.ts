// src/controllers/authentication/logout.ts
import { Request, Response } from 'express';

import { asyncHandler } from '#middlewares/error-handler.js';
import { logout as logoutService } from '#services/auth.service.js';
import { CookieManager } from '#utils/CookieManager.js';
import { sendSuccess } from '#utils/http-response.js';

/**
 * Logout: consume the presented refresh token's server-side registration so
 * it can never be exchanged again, then clear both cookies. Tolerates a
 * missing/expired refresh cookie — "log out" always succeeds.
 */
export const logout = asyncHandler(async (req: Request, res: Response) => {
  await logoutService(CookieManager.getCookie(req, 'refreshToken'));

  CookieManager.clearAllTokens(res);
  sendSuccess(res, { message: 'Logged out successfully' });
});

export default logout;
