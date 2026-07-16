// src/routes/authentication/contact-change.ts
//
// Self-service email/phone changes. change-* and confirm-phone-change need a
// full session (the /auth router mounts before the global authenticate-jwt,
// so they apply it themselves); confirm-email-change is PUBLIC — the emailed
// token is the credential, like reset-password. Everything sits behind the
// auth brute-force limiter (password guesses feed the login lockout counter;
// codes are attempt-capped; the limiter caps raw volume).
//
// /reauth/challenge reuses the 2FA challenge engine verbatim: it sends a
// TWO_FACTOR-style code to the account's CURRENT contact, which change-email
// / change-phone accept as the re-auth proof for PASSWORDLESS accounts
// (accounts with a password re-auth with currentPassword instead).
import { Router } from 'express';

import {
  challengeTwoFactor,
  changeEmail,
  changePhone,
  confirmEmailChange,
  confirmPhoneChange,
} from '#controllers/authentication/index.js';
import authenticateJWT from '#middlewares/authenticate-jwt.js';
import { authRateLimiter } from '#middlewares/rateLimit.js';

const contactChangeRoutes = Router();

// Re-auth code for passwordless accounts — the existing 2FA challenge engine.
contactChangeRoutes.post(
  '/reauth/challenge',
  authRateLimiter,
  authenticateJWT,
  challengeTwoFactor,
);

contactChangeRoutes.post(
  '/change-email',
  authRateLimiter,
  authenticateJWT,
  ...changeEmail,
);

// PUBLIC: the token emailed to the NEW address is the credential.
contactChangeRoutes.post(
  '/confirm-email-change',
  authRateLimiter,
  ...confirmEmailChange,
);

contactChangeRoutes.post(
  '/change-phone',
  authRateLimiter,
  authenticateJWT,
  ...changePhone,
);

// AUTHENTICATED: the code proves possession of the new phone; the session
// proves the account.
contactChangeRoutes.post(
  '/confirm-phone-change',
  authRateLimiter,
  authenticateJWT,
  ...confirmPhoneChange,
);

export default contactChangeRoutes;
