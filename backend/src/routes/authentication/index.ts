// src/routes/authentication/index.ts
import { Router } from 'express';

import loginRoutes from './login';
import logoutRoutes from './logout';
import refreshRoutes from './refresh-token';
import registerRoutes from './register';

const authenticationRouter = Router();

authenticationRouter.use('/auth', registerRoutes);
authenticationRouter.use('/auth', loginRoutes);
authenticationRouter.use('/auth', refreshRoutes);
authenticationRouter.use('/auth', logoutRoutes);

export { authenticationRouter };
