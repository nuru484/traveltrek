// src/routes/authentication/logout.ts
import { Router } from 'express';

import { logout } from '#controllers/authentication/index.js';

const logoutRoutes = Router();

logoutRoutes.post('/logout', logout);

export default logoutRoutes;
