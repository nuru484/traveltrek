// src/controllers/authentication/login.ts
//
// Password login resolves EITHER principal (customer by email first, then
// staff — precedence lives in the service); the controller mints the session
// for whichever came back and picks the matching DTO.
//
// 2FA: when the principal has twoFactorEnabled the service has already sent a
// code and NO session may be issued — instead of auth cookies the response
// carries { twoFactorRequired: true } (no user object) plus the short-lived
// signed twoFactorPending cookie that lets /auth/2fa/{verify,resend} know who
// is mid-login. OTP login and Google sign-in bypass 2FA (single possession
// factor already) — see the service notes.
import { Request, RequestHandler, Response } from 'express';

import { asyncHandler } from '#middlewares/error-handler.js';
import zodValidation from '#middlewares/validate-request.js';
import {
  login as loginService,
  mintAuthTokens,
  toTokenPrincipal,
} from '#services/auth.service.js';
import { CookieManager } from '#utils/CookieManager.js';
import { sendSuccess } from '#utils/http-response.js';
import { toCustomerDTO } from '#utils/mappers/customer.mapper.js';
import { toUserDTO } from '#utils/mappers/user.mapper.js';
import { signTwoFactorPendingToken } from '#utils/two-factor-pending.js';
import { LoginBody, loginSchema } from '#validations/auth-validation.js';

const handleLogin = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body as LoginBody;

  const { principal, twoFactorRequired } = await loginService({
    email,
    password,
  });

  if (twoFactorRequired) {
    const pendingId =
      principal.kind === 'customer' ? principal.customer.id : principal.user.id;
    CookieManager.setTwoFactorPendingToken(
      res,
      signTwoFactorPendingToken({ id: pendingId, kind: principal.kind }),
    );
    sendSuccess(res, {
      data: { twoFactorRequired: true },
      message: 'Enter the verification code we just sent you.',
    });
    return;
  }

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

export const login: RequestHandler[] = [
  ...zodValidation.body(loginSchema),
  handleLogin,
];
