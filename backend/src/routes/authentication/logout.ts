// src/routes/authentication/logout.ts
import { Router } from 'express';

import { logout } from '../../controllers/authentication/index';

const logoutRoutes = Router();

logoutRoutes.post('/logout', logout);

export default logoutRoutes;
