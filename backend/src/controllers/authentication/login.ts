import { compare } from 'bcrypt';
// src/controllers/authentication/login.ts
import { NextFunction, Response } from 'express';
import jwt from 'jsonwebtoken';

import ENV from '#config/env.js';
import { assertEnv } from '#config/env.js';
import prisma from '#config/prismaClient.js';
import {
  asyncHandler,
  NotFoundError,
  UnauthorizedError,
} from '#middlewares/error-handler.js';
import { ILoginRequest } from '#types/auth.types.js';
import { CookieManager } from '#utils/CookieManager.js';

const login = asyncHandler(
  async (
    req: ILoginRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { email, password } = req.body;

      const user = await prisma.user.findUnique({
        select: {
          address: true,
          createdAt: true,
          email: true,
          id: true,
          name: true,
          password: true,
          phone: true,
          profilePicture: true,
          role: true,
          updatedAt: true,
        },
        where: {
          email,
        },
      });

      if (!user || !password || !user.password) {
        throw new NotFoundError('Invalid credentials');
      }

      const isPasswordValid = await compare(password, user.password);

      if (!isPasswordValid) {
        throw new UnauthorizedError('Invalid credentials');
      }

      const accessToken = jwt.sign(
        { id: user.id, role: user.role },
        assertEnv(ENV.ACCESS_TOKEN_SECRET, 'ACCESS_TOKEN_SECRET'),
        { expiresIn: '30m' },
      );

      const refreshToken = jwt.sign(
        { id: user.id, role: user.role },
        assertEnv(ENV.REFRESH_TOKEN_SECRET, 'REFRESH_TOKEN_SECRET'),
        {
          expiresIn: '7d',
        },
      );

      CookieManager.clearAllTokens(res);
      CookieManager.setAccessToken(res, accessToken);
      CookieManager.setRefreshToken(res, refreshToken);

      const { password: _password, ...userWithoutPassword } = user;

      res.json({ data: userWithoutPassword, message: 'Login successful' });
    } catch (error) {
      next(error);
    }
  },
);

export default login;
