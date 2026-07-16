// src/routes/authentication/login.ts
import { Router } from 'express';

import { login } from '#controllers/authentication/index.js';

const loginRoutes = Router();

loginRoutes.post('/login', login);

export default loginRoutes;
