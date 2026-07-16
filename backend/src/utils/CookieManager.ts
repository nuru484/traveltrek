import { Request, Response } from 'express';

import ENV from '#config/env.js';
import { UnauthorizedError } from '#middlewares/error-handler.js';

export interface CookieOptions {
  domain?: string;
  httpOnly?: boolean;
  maxAge?: number;
  path?: string;
  sameSite?: 'lax' | 'none' | 'strict';
  secure?: boolean;
}

// Default options that apply to all cookies
const defaultOptions: CookieOptions = {
  domain: ENV.COOKIE_DOMAIN,
  httpOnly: true,
  path: '/',
  sameSite: 'lax',
  secure: ENV.NODE_ENV === 'production',
};

// Specific configurations for different token types
const tokenConfigs = {
  accessToken: {
    ...defaultOptions,
  },
  refreshToken: {
    ...defaultOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
};

// cookie-parser types req.cookies as any; narrow it once here
const cookiesOf = (req: Request): Record<string, string | undefined> =>
  req.cookies as Record<string, string | undefined>;

const setCookie = (
  res: Response,
  name: string,
  value: string,
  options: CookieOptions = {},
): void => {
  res.cookie(name, value, {
    ...defaultOptions,
    ...options,
  });
};

/**
 * Utilities for managing HTTP auth cookies in an Express application.
 * Sets, gets, and clears access/refresh token cookies with secure defaults.
 */
export const CookieManager = {
  /**
   * Clears both access and refresh token cookies.
   */
  clearAllTokens(res: Response): void {
    CookieManager.clearToken(res, 'accessToken');
    CookieManager.clearToken(res, 'refreshToken');
  },

  /**
   * Clears a specified authentication token cookie by setting its expiration to 0.
   */
  clearToken(res: Response, tokenName: 'accessToken' | 'refreshToken'): void {
    setCookie(res, tokenName, '', {
      ...defaultOptions,
      maxAge: 0,
    });
  },

  /**
   * Retrieves the access token from request cookies.
   * @throws UnauthorizedError if the access token is not found in the cookies.
   */
  getAccessToken(req: Request): string {
    const token = cookiesOf(req).accessToken;
    if (!token) {
      throw new UnauthorizedError('Access token not found. Please login', {
        code: 'MISSING_TOKEN',
        context: { token: null },
        layer: 'jwt',
      });
    }
    return token;
  },

  /**
   * Retrieves a cookie by name from the request.
   * @param required - If true, throws when the cookie is not found; otherwise returns null.
   * @throws UnauthorizedError if the cookie is required but not found.
   */
  getCookie(req: Request, name: string, required = false): null | string {
    const value = cookiesOf(req)[name] ?? null;

    if (required && value === null) {
      throw new UnauthorizedError(`Cookie ${name} not found`, {
        code: 'MISSING_COOKIE',
        context: { cookieName: name },
        layer: 'cookie',
      });
    }

    return value;
  },

  /**
   * Retrieves the refresh token from request cookies.
   * @throws UnauthorizedError if the refresh token is not found in the cookies.
   */
  getRefreshToken(req: Request): string {
    const token = cookiesOf(req).refreshToken;
    if (!token) {
      throw new UnauthorizedError('Refresh token not found. Please login', {
        code: 'MISSING_TOKEN',
        context: { token: null },
        layer: 'jwt',
      });
    }
    return token;
  },

  /**
   * Sets the httpOnly access token cookie (session-scoped).
   */
  setAccessToken(res: Response, token: string): void {
    setCookie(res, 'accessToken', token, tokenConfigs.accessToken);
  },

  /**
   * Sets the httpOnly refresh token cookie with a 7-day expiration.
   */
  setRefreshToken(res: Response, token: string): void {
    setCookie(res, 'refreshToken', token, tokenConfigs.refreshToken);
  },
};
