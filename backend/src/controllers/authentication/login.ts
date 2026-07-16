// src/controllers/authentication/login.ts
//
// Password login resolves EITHER principal (customer by email first, then
// staff — precedence lives in the service); the controller mints the session
// for whichever came back and picks the matching DTO.
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
import { LoginBody, loginSchema } from '#validations/auth-validation.js';

const handleLogin = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body as LoginBody;

  const principal = await loginService({ email, password });
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
