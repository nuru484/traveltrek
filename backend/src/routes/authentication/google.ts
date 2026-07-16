// src/routes/authentication/google.ts
//
// Google sign-in, behind the same failed-attempt brute-force limiter as the
// other credential endpoints (a successful sign-in never counts).
import { Router } from 'express';

import { googleSignIn } from '#controllers/authentication/index.js';
import { authRateLimiter } from '#middlewares/rateLimit.js';

const googleRoutes = Router();

googleRoutes.post('/google', authRateLimiter, ...googleSignIn);

export default googleRoutes;
