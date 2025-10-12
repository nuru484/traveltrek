import { Request, Response, NextFunction } from 'express';
import { TokenExpiredError, JsonWebTokenError } from 'jsonwebtoken';
import ENV from '../config/env';
import { asyncHandler, UnauthorizedError } from '../middlewares/error-handler';
import { IUser } from 'types/user-profile.types';
import { assertEnv } from '../config/env';
import { verifyJwtToken } from '../utils/verify-jwt-token';
import { CookieManager } from '../utils/CookieManager';

const authenticateJWT = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const token = CookieManager.getAccessToken(req);

    if (!token) {
      throw new UnauthorizedError('Access token not found', {
        layer: 'jwt',
        code: 'MISSING_TOKEN',
        context: { token },
      });
    }

    try {
      const decodedUser = await verifyJwtToken<IUser>(
        token,
        assertEnv(ENV.ACCESS_TOKEN_SECRET, 'ACCESS_TOKEN_SECRET'),
      );

      req.user = decodedUser;

      next();
    } catch (tokenError) {
      if (tokenError instanceof TokenExpiredError) {
        throw new UnauthorizedError('Access token expired.', {
          layer: 'jwt',
          code: 'EXPIRED_TOKEN',
          context: { token },
        });
      }

      if (tokenError instanceof JsonWebTokenError) {
        throw new UnauthorizedError(
          'Invalid access token. Please login again',
          {
            layer: 'jwt',
            code: 'INVALID_TOKEN',
            context: { token },
          },
        );
      }

      throw tokenError;
    }
  },
);

export default authenticateJWT;
