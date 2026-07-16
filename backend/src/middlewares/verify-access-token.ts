import { NextFunction, Request, Response } from 'express';

import ENV from '../config/env';
import { assertEnv } from '../config/env';
import { CookieManager } from '../utils/CookieManager';
import { verifyJwtToken } from '../utils/verify-jwt-token';

export const verifyAccessToken = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const accessToken = CookieManager.getAccessToken(req);

  if (!accessToken) {
    next();
    return;
  }

  try {
    const decoded = await verifyJwtToken(
      accessToken,
      assertEnv(ENV.ACCESS_TOKEN_SECRET, 'ACCESS_TOKEN_SECRET'),
    );
    req.user = decoded;
    next();
  } catch (_error) {
    next();
  }
};
