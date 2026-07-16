// src/routes/authentication/two-factor.ts
//
// Two-factor authentication. The login second step (verify/resend) is
// UNauthenticated — the signed twoFactorPending cookie is its gate — and sits
// behind the failed-attempt brute-force limiter (wrong codes count, resend's
// own 60s cooldown throttles send volume). Management (challenge / enable /
// disable / status) requires a full session, so those routes mount
// authenticate-jwt themselves (the /auth router lives before the global one).
import { Router } from 'express';

import {
  challengeTwoFactor,
  disableTwoFactor,
  enableTwoFactor,
  resendTwoFactor,
  twoFactorStatus,
  verifyTwoFactor,
} from '#controllers/authentication/index.js';
import authenticateJWT from '#middlewares/authenticate-jwt.js';
import { authRateLimiter } from '#middlewares/rateLimit.js';

const twoFactorRoutes = Router();

// Login second step — pending-cookie gated.
twoFactorRoutes.post('/2fa/verify', authRateLimiter, ...verifyTwoFactor);
twoFactorRoutes.post('/2fa/resend', authRateLimiter, resendTwoFactor);

// Management — full session required.
twoFactorRoutes.post(
  '/2fa/challenge',
  authRateLimiter,
  authenticateJWT,
  challengeTwoFactor,
);
twoFactorRoutes.post(
  '/2fa/enable',
  authRateLimiter,
  authenticateJWT,
  ...enableTwoFactor,
);
twoFactorRoutes.post(
  '/2fa/disable',
  authRateLimiter,
  authenticateJWT,
  ...disableTwoFactor,
);
twoFactorRoutes.get('/2fa/status', authenticateJWT, twoFactorStatus);

export default twoFactorRoutes;
