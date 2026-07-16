// src/routes/authentication/otp.ts
//
// Passwordless OTP login. Both steps sit behind the failed-attempt brute-force
// limiter: request always succeeds (its own 60s per-account cooldown throttles
// send volume), while wrong codes on verify count toward the per-IP cap.
import { Router } from 'express';

import { requestOtp, verifyOtp } from '#controllers/authentication/index.js';
import { authRateLimiter } from '#middlewares/rateLimit.js';

const otpRoutes = Router();

otpRoutes.post('/otp/request', authRateLimiter, ...requestOtp);
otpRoutes.post('/otp/verify', authRateLimiter, ...verifyOtp);

export default otpRoutes;
