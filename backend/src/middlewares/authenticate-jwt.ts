import { NextFunction, Request, Response } from 'express';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';

import ENV from '../config/env';
import { assertEnv } from '../config/env';
import { asyncHandler, UnauthorizedError } from '../middlewares/error-handler';
import { CookieManager } from '../utils/CookieManager';
import { verifyJwtToken } from '../utils/verify-jwt-token';

const authenticateJWT = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const token = CookieManager.getAccessToken(req);

    if (!token) {
      throw new UnauthorizedError('Access token not found', {
        code: 'MISSING_TOKEN',
        context: { token },
        layer: 'jwt',
      });
    }

    try {
      const decodedUser = await verifyJwtToken(
        token,
        assertEnv(ENV.ACCESS_TOKEN_SECRET, 'ACCESS_TOKEN_SECRET'),
      );

      req.user = decodedUser;

      next();
    } catch (tokenError) {
      if (tokenError instanceof TokenExpiredError) {
        throw new UnauthorizedError('Access token expired.', {
          code: 'EXPIRED_TOKEN',
          context: { token },
          layer: 'jwt',
        });
      }

      if (tokenError instanceof JsonWebTokenError) {
        throw new UnauthorizedError(
          'Invalid access token. Please login again',
          {
            code: 'INVALID_TOKEN',
            context: { token },
            layer: 'jwt',
          },
        );
      }

      throw tokenError;
    }
  },
);

export default authenticateJWT;
