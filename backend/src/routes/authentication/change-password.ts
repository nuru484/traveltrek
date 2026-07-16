// src/routes/authentication/change-password.ts
//
// Authenticated password set/rotate (the ONLY password-writing surface for
// existing accounts). Behind the hourly reset limiter — wrong currentPassword
// guesses already feed the login lockout counter, and the limiter caps how
// fast a hijacked session can even try. The /auth router mounts before the
// global authenticate-jwt, so this route applies it itself.
import { Router } from 'express';

import { changePassword } from '#controllers/authentication/index.js';
import authenticateJWT from '#middlewares/authenticate-jwt.js';
import { passwordResetLimiter } from '#middlewares/rateLimit.js';

const changePasswordRoutes = Router();

changePasswordRoutes.post(
  '/change-password',
  passwordResetLimiter,
  authenticateJWT,
  ...changePassword,
);

export default changePasswordRoutes;
