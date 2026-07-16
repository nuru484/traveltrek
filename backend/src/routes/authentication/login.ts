// src/routes/authentication/login.ts
import { Router } from 'express';

import { login } from '#controllers/authentication/index.js';
import { authRateLimiter } from '#middlewares/rateLimit.js';

const loginRoutes = Router();

loginRoutes.post('/login', authRateLimiter, ...login);

export default loginRoutes;
