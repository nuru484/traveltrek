// test/helpers/auth.ts
//
// Auth plumbing for integration tests: mint real JWTs the same way the login
// controller does, and wrap supertest so authenticated requests carry the
// httpOnly access-token cookie.
import jwt from 'jsonwebtoken';
import request from 'supertest';

import type { User } from '#config/prismaClient.js';

import ENV from '#config/env.js';

import app from '../../app.js';

/** What the token helpers need; tokenVersion defaults to 0 (a fresh user). */
type TokenUser = Pick<User, 'id' | 'role'> & { tokenVersion?: number };

export const api = () => request(app);

export const mintAccessToken = (user: TokenUser): string =>
  jwt.sign(
    { id: user.id, role: user.role, tokenVersion: user.tokenVersion ?? 0 },
    ENV.ACCESS_TOKEN_SECRET,
    { expiresIn: '30m' },
  );

/** Supertest wrapper whose requests carry the user's access-token cookie. */
export const authedApi = (user: TokenUser) => {
  const token = mintAccessToken(user);
  const cookie = `accessToken=${token}`;
  return {
    delete: (url: string) => request(app).delete(url).set('Cookie', cookie),
    get: (url: string) => request(app).get(url).set('Cookie', cookie),
    patch: (url: string) => request(app).patch(url).set('Cookie', cookie),
    post: (url: string) => request(app).post(url).set('Cookie', cookie),
    put: (url: string) => request(app).put(url).set('Cookie', cookie),
  };
};

/** Extract a cookie value from a supertest response's Set-Cookie headers. */
export const cookieValue = (
  res: { headers: Record<string, string | string[] | undefined> },
  name: string,
): string | undefined => {
  const raw = res.headers['set-cookie'];
  const cookies = Array.isArray(raw) ? raw : raw ? [raw] : [];
  // Take the LAST match: login clears old cookies before setting fresh ones,
  // so the same name can appear twice in one response.
  const match = cookies.filter((c) => c.startsWith(`${name}=`)).at(-1);
  const value = match?.split(';')[0].slice(name.length + 1);
  // Cleared cookies serialize as `name=` — report those as absent.
  return value === '' ? undefined : value;
};
