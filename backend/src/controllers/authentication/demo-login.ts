// src/controllers/authentication/demo-login.ts
//
// Server-side demo login. The service resolves a REAL account for the
// requested role (ADMIN/AGENT staff User, or CUSTOMER) — gated by
// DEMO_LOGIN_ENABLED (403 off) — and this controller mints the session for it
// exactly like handleLogin does, so the demo session is indistinguishable from
// a password login. No 2FA hand-off here: a demo account is a fixture, not a
// user protecting a real identity.
import { Request, RequestHandler, Response } from 'express';

import { asyncHandler } from '#middlewares/error-handler.js';
import zodValidation from '#middlewares/validate-request.js';
import {
  demoLogin as demoLoginService,
  mintAuthTokens,
  toTokenPrincipal,
} from '#services/auth.service.js';
import { CookieManager } from '#utils/CookieManager.js';
import { sendSuccess } from '#utils/http-response.js';
import { toCustomerDTO } from '#utils/mappers/customer.mapper.js';
import { toUserDTO } from '#utils/mappers/user.mapper.js';
import { DemoLoginBody, demoLoginSchema } from '#validations/auth-validation.js';

const handleDemoLogin = asyncHandler(async (req: Request, res: Response) => {
  const { role } = req.body as DemoLoginBody;

  const principal = await demoLoginService(role);
  const tokens = await mintAuthTokens(toTokenPrincipal(principal));

  CookieManager.setAuthTokens(res, tokens);
  sendSuccess(res, {
    data:
      principal.kind === 'customer'
        ? toCustomerDTO(principal.customer)
        : toUserDTO(principal.user),
    message: 'Login successful',
  });
});

export const demoLogin: RequestHandler[] = [
  ...zodValidation.body(demoLoginSchema),
  handleDemoLogin,
];
