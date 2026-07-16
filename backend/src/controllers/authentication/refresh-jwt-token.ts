// src/controllers/authentication/refreshJwtToken.ts
import { NextFunction, Request, Response } from 'express';
import jwt, { TokenExpiredError } from 'jsonwebtoken';
import { IUser } from 'types/user-profile.types';

import ENV from '../../config/env';
import { assertEnv } from '../../config/env';
import prisma from '../../config/prismaClient';
import {
  asyncHandler,
  CustomError,
  NotFoundError,
  UnauthorizedError,
} from '../../middlewares/error-handler';
import { CookieManager } from '../../utils/CookieManager';
import { verifyJwtToken } from '../../utils/verify-jwt-token';

/**
 * Refreshes access token using a valid refresh token
 * @param req - Express request object with user and cookies
 * @param res - Express response object
 * @param next - Express next function
 */
const refreshToken: (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<void> = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const currentRefreshToken = CookieManager.getRefreshToken(req);

    if (!currentRefreshToken) {
      throw new UnauthorizedError('Unauthorised, no refresh token provided', {
        layer: 'refreshToken',
      });
    }

    // Verify token and decode user
    let decodedUser: IUser;
    try {
      decodedUser = await verifyJwtToken(
        currentRefreshToken,
        assertEnv(ENV.REFRESH_TOKEN_SECRET, 'REFRESH_TOKEN_SECRET'),
      );
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        throw new UnauthorizedError(
          'Unauthorised, refresh token expired. Please log in again.',
          {
            layer: 'refreshToken',
          },
        );
      }
      throw new CustomError(401, 'Invalid refresh token');
    }

    const newRefreshToken = jwt.sign(
      { id: decodedUser.id, role: decodedUser.role },
      assertEnv(ENV.REFRESH_TOKEN_SECRET, 'REFRESH_TOKEN_SECRET'),
      { expiresIn: '7d' },
    );

    const newAccessToken = jwt.sign(
      {
        id: decodedUser.id,
        role: decodedUser.role,
      },
      assertEnv(ENV.ACCESS_TOKEN_SECRET, 'ACCESS_TOKEN_SECRET'),
      { expiresIn: '15m' },
    );

    CookieManager.clearAllTokens(res);
    CookieManager.setAccessToken(res, newAccessToken);
    CookieManager.setRefreshToken(res, newRefreshToken);

    const user = await prisma.user.findUnique({
      where: { id: decodedUser.id },
    });

    if (!user) {
      throw new NotFoundError('Invalid credentials');
    }

    const { password: _password, ...userWithoutPassword } = user;

    res.status(200).json({
      data: userWithoutPassword,
      message: 'Token refreshed successfully',
    });
  },
);

export default refreshToken;
