// src/routes/authentication/register.ts
import { Router } from 'express';

import { registerUser } from '#controllers/authentication/index.js';
import { authRateLimiter } from '#middlewares/rateLimit.js';

const registerRoutes = Router();

registerRoutes.post('/register-user', authRateLimiter, ...registerUser);

export default registerRoutes;
