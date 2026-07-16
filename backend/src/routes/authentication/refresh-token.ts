import { Router } from 'express';

import { refreshToken } from '#controllers/authentication/index.js';
import { verifyAccessToken } from '#middlewares/verify-access-token.js';

const refreshRoutes = Router();

refreshRoutes.post('/refresh-token', verifyAccessToken, refreshToken);

export default refreshRoutes;
