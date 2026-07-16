// src/routes/authentication/refresh-token.ts
import { Router } from 'express';

import { refreshToken } from '#controllers/authentication/index.js';
import { authRateLimiter } from '#middlewares/rateLimit.js';

const refreshRoutes = Router();

refreshRoutes.post('/refresh-token', authRateLimiter, refreshToken);

export default refreshRoutes;
