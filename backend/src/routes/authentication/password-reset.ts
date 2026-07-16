// src/routes/authentication/password-reset.ts
//
// Forgot/reset password, both behind the dedicated hourly reset limiter —
// forgot caps outbound email volume per IP, reset keeps tokens from being
// guessed by volume.
import { Router } from 'express';

import {
  forgotPassword,
  resetPassword,
} from '#controllers/authentication/index.js';
import { passwordResetLimiter } from '#middlewares/rateLimit.js';

const passwordResetRoutes = Router();

passwordResetRoutes.post(
  '/forgot-password',
  passwordResetLimiter,
  ...forgotPassword,
);
passwordResetRoutes.post(
  '/reset-password',
  passwordResetLimiter,
  ...resetPassword,
);

export default passwordResetRoutes;
