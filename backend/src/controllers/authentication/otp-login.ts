// src/controllers/authentication/otp-login.ts
//
// Thin bundles over the auth service's passwordless OTP login — a
// CUSTOMER-ONLY surface (staff use passwords). The request step replies with
// the SAME 200 whether or not the contact has an account (no enumeration);
// the verify step is a full login — cookies are issued the same way password
// login issues them.
import { Request, RequestHandler, Response } from 'express';

import { asyncHandler } from '#middlewares/error-handler.js';
import zodValidation from '#middlewares/validate-request.js';
import {
  customerPrincipal,
  mintAuthTokens,
  requestOtpLogin as requestOtpLoginService,
  verifyOtpLogin as verifyOtpLoginService,
} from '#services/auth.service.js';
import { CookieManager } from '#utils/CookieManager.js';
import { sendSuccess } from '#utils/http-response.js';
import { toCustomerDTO } from '#utils/mappers/customer.mapper.js';
import {
  OtpRequestBody,
  otpRequestSchema,
  OtpVerifyBody,
  otpVerifySchema,
} from '#validations/auth-validation.js';

const handleRequestOtp = asyncHandler(async (req: Request, res: Response) => {
  const { email, phone } = req.body as OtpRequestBody;

  await requestOtpLoginService({ email, phone });

  // One fixed message for known and unknown contacts alike.
  sendSuccess(res, {
    message: 'If an account exists for that contact, a login code is on its way.',
  });
});

const handleVerifyOtp = asyncHandler(async (req: Request, res: Response) => {
  const { code, email, phone } = req.body as OtpVerifyBody;

  const customer = await verifyOtpLoginService({ email, phone }, code);
  const tokens = await mintAuthTokens(customerPrincipal(customer));

  CookieManager.setAuthTokens(res, tokens);
  sendSuccess(res, {
    data: toCustomerDTO(customer),
    message: 'Login successful',
  });
});

export const requestOtp: RequestHandler[] = [
  ...zodValidation.body(otpRequestSchema),
  handleRequestOtp,
];

export const verifyOtp: RequestHandler[] = [
  ...zodValidation.body(otpVerifySchema),
  handleVerifyOtp,
];
