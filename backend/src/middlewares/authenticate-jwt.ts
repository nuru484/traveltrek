import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import ENV from '#config/env.js';
import { assertEnv } from '#config/env.js';
import { asyncHandler, UnauthorizedError } from '#middlewares/error-handler.js';
import { CookieManager } from '#utils/CookieManager.js';
import { verifyJwtToken } from '#utils/verify-jwt-token.js';

// jsonwebtoken is CJS — its error classes aren't detectable as named ESM
// exports, so destructure them off the default export.
const { JsonWebTokenError, TokenExpiredError } = jwt;

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
