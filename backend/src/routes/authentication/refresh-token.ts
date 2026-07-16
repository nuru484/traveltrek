import { Router } from 'express';

import { refreshToken } from '../../controllers/authentication/index';
import { verifyAccessToken } from '../../middlewares/verify-access-token';

const refreshRoutes = Router();

refreshRoutes.post('/refresh-token', verifyAccessToken, refreshToken);

export default refreshRoutes;
