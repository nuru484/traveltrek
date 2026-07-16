// src/controllers/authentication/login.ts
import { Request, RequestHandler, Response } from 'express';

import { asyncHandler } from '#middlewares/error-handler.js';
import zodValidation from '#middlewares/validate-request.js';
import {
  login as loginService,
  mintAuthTokens,
} from '#services/auth.service.js';
import { CookieManager } from '#utils/CookieManager.js';
import { sendSuccess } from '#utils/http-response.js';
import { toUserDTO } from '#utils/mappers/user.mapper.js';
import { LoginBody, loginSchema } from '#validations/auth-validation.js';

const handleLogin = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body as LoginBody;

  const user = await loginService({ email, password });
  const tokens = await mintAuthTokens(user);

  CookieManager.setAuthTokens(res, tokens);
  sendSuccess(res, { data: toUserDTO(user), message: 'Login successful' });
});

export const login: RequestHandler[] = [
  ...zodValidation.body(loginSchema),
  handleLogin,
];
