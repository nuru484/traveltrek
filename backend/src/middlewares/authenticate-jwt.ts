// src/middlewares/authenticate-jwt.ts
import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import type { AccessTokenPayload } from '#types/auth.types.js';

import ENV from '#config/env.js';
import prisma from '#config/prismaClient.js';
import { asyncHandler, UnauthorizedError } from '#middlewares/error-handler.js';
import {
  getCachedTokenVersion,
  setCachedTokenVersion,
} from '#utils/authz-cache.js';
import { CookieManager } from '#utils/CookieManager.js';
import { verifyJwtToken } from '#utils/verify-jwt-token.js';

// jsonwebtoken is CJS — its error classes aren't detectable as named ESM
// exports, so destructure them off the default export.
const { JsonWebTokenError, TokenExpiredError } = jwt;

/**
 * The user's live session epoch, behind a short cache so the per-request check
 * doesn't hit the DB every time. A refresh-theft response bumps tokenVersion
 * and invalidates this entry, so already-issued access tokens stop working at
 * once (this instance) or within the cache TTL (other instances) — unlike a
 * plain stateless JWT that stays valid until it expires. Returns null when the
 * account no longer exists.
 */
const resolveLiveTokenVersion = async (
  userId: number,
): Promise<null | number> => {
  const cached = getCachedTokenVersion(userId);
  if (cached !== undefined) return cached;

  const user = await prisma.user.findUnique({
    select: { tokenVersion: true },
    where: { id: userId },
  });
  const version = user?.tokenVersion ?? null;
  setCachedTokenVersion(userId, version);
  return version;
};

const authenticateJWT = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const token = CookieManager.getAccessToken(req);

    let decodedUser: AccessTokenPayload;
    try {
      decodedUser = await verifyJwtToken<AccessTokenPayload>(
        token,
        ENV.ACCESS_TOKEN_SECRET,
      );
    } catch (tokenError) {
      if (tokenError instanceof TokenExpiredError) {
        throw new UnauthorizedError('Access token expired.', {
          code: 'EXPIRED_TOKEN',
          layer: 'jwt',
        });
      }
      if (tokenError instanceof JsonWebTokenError) {
        throw new UnauthorizedError(
          'Invalid access token. Please login again',
          {
            code: 'INVALID_TOKEN',
            layer: 'jwt',
          },
        );
      }
      throw tokenError;
    }

    // Enforce the session epoch: reject tokens minted before a theft-response
    // bump, and tokens for accounts that no longer exist.
    const liveVersion = await resolveLiveTokenVersion(decodedUser.id);
    if (liveVersion === null) {
      throw new UnauthorizedError('Account no longer exists. Please log in.', {
        code: 'USER_NOT_FOUND',
        layer: 'jwt',
      });
    }
    if (decodedUser.tokenVersion !== liveVersion) {
      throw new UnauthorizedError(
        'Session has been invalidated. Please log in again.',
        { code: 'STALE_TOKEN_VERSION', layer: 'jwt' },
      );
    }

    req.user = decodedUser;
    next();
  },
);

export default authenticateJWT;
