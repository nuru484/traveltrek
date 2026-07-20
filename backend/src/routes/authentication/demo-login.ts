// src/routes/authentication/demo-login.ts
import { Router } from 'express';

import { demoLogin } from '#controllers/authentication/index.js';
import { authRateLimiter } from '#middlewares/rateLimit.js';

const demoLoginRoutes = Router();

demoLoginRoutes.post('/demo-login', authRateLimiter, ...demoLogin);

export default demoLoginRoutes;
