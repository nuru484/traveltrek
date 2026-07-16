// src/routes/authentication/register.ts
import { Router } from 'express';

import { registerUser } from '#controllers/authentication/index.js';

const registerRoutes = Router();

registerRoutes.post('/register-user', ...registerUser);

export default registerRoutes;
