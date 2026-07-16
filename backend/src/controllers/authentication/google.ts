// src/controllers/authentication/google.ts
//
// Thin bundle over the auth service's Google sign-in — a CUSTOMER-ONLY
// surface: the frontend obtains a Google ID token and posts it here; the
// service verifies it (503 when GOOGLE_CLIENT_ID is not configured),
// resolves/creates the customer, and a session is issued exactly like
// password login.
import { Request, RequestHandler, Response } from 'express';

import { asyncHandler } from '#middlewares/error-handler.js';
import zodValidation from '#middlewares/validate-request.js';
import {
  customerPrincipal,
  googleSignIn as googleSignInService,
  mintAuthTokens,
} from '#services/auth.service.js';
import { CookieManager } from '#utils/CookieManager.js';
import { sendSuccess } from '#utils/http-response.js';
import { toCustomerDTO } from '#utils/mappers/customer.mapper.js';
import {
  GoogleSignInBody,
  googleSignInSchema,
} from '#validations/auth-validation.js';

const handleGoogleSignIn = asyncHandler(
  async (req: Request, res: Response) => {
    const { idToken } = req.body as GoogleSignInBody;

    const customer = await googleSignInService(idToken);
    const tokens = await mintAuthTokens(customerPrincipal(customer));

    CookieManager.setAuthTokens(res, tokens);
    sendSuccess(res, {
      data: toCustomerDTO(customer),
      message: 'Login successful',
    });
  },
);

export const googleSignIn: RequestHandler[] = [
  ...zodValidation.body(googleSignInSchema),
  handleGoogleSignIn,
];
