// src/routes/authentication/index.ts
import { Router } from 'express';

import loginRoutes from '#routes/authentication/login.js';
import logoutRoutes from '#routes/authentication/logout.js';
import refreshRoutes from '#routes/authentication/refresh-token.js';
import registerRoutes from '#routes/authentication/register.js';

const authenticationRouter = Router();

authenticationRouter.use('/auth', registerRoutes);
authenticationRouter.use('/auth', loginRoutes);
authenticationRouter.use('/auth', refreshRoutes);
authenticationRouter.use('/auth', logoutRoutes);

export { authenticationRouter };
