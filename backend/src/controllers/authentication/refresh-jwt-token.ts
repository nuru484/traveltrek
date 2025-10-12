// src/controllers/authentication/refreshJwtToken.ts
import { Request, Response, NextFunction } from 'express';
import jwt, { TokenExpiredError } from 'jsonwebtoken';
import ENV from '../../config/env';
import { verifyJwtToken } from '../../utils/verify-jwt-token';
import {
  CustomError,
  UnauthorizedError,
  asyncHandler,
  NotFoundError,
} from '../../middlewares/error-handler';
import { IUser } from 'types/user-profile.types';
import { assertEnv } from '../../config/env';
import { CookieManager } from '../../utils/CookieManager';
import prisma from '../../config/prismaClient';

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
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const currentRefreshToken = CookieManager.getRefreshToken(req);

    if (!currentRefreshToken) {
      throw new UnauthorizedError('Unauthorised, no refresh token provided', {
        layer: 'refreshToken',
      });
    }

    // Verify token and decode user
    let decodedUser: IUser;
    try {
      decodedUser = await verifyJwtToken<IUser>(
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

    const { password: userPassWord, ...userWithoutPassword } = user;

    res.status(200).json({
      message: 'Token refreshed successfully',
      data: userWithoutPassword,
    });
  },
);

export default refreshToken;
