// src/controllers/authentication/refresh-jwt-token.ts
import { Request, Response } from 'express';

import { asyncHandler } from '#middlewares/error-handler.js';
import { refresh as refreshService } from '#services/auth.service.js';
import { CookieManager } from '#utils/CookieManager.js';
import { sendSuccess } from '#utils/http-response.js';
import { toCustomerDTO } from '#utils/mappers/customer.mapper.js';
import { toUserDTO } from '#utils/mappers/user.mapper.js';

/**
 * Exchanges a valid refresh cookie for a fresh access+refresh pair (full
 * rotation — see auth.service refresh): the presented token's jti is consumed
 * server-side, so each refresh token is spendable exactly once, and a replay
 * outside the tab-race grace window signs the account out everywhere. Works
 * for either principal — the token's `kind` claim names the table.
 */
const refreshToken = asyncHandler(async (req: Request, res: Response) => {
  // Throws 401 when the cookie is missing.
  const presented = CookieManager.getRefreshToken(req);

  const { principal, tokens } = await refreshService(presented);

  CookieManager.setAuthTokens(res, tokens);
  sendSuccess(res, {
    data:
      principal.kind === 'customer'
        ? toCustomerDTO(principal.customer)
        : toUserDTO(principal.user),
    message: 'Token refreshed successfully',
  });
});

export default refreshToken;
