// test/integration/auth.test.ts
//
// Behaviour of the hardened authentication flows: enumeration-safe login with
// account lockout, refresh-token ROTATION (single-use tokens, theft response
// via the tokenVersion session epoch), and logout consuming the refresh
// registration.
import { describe, expect, it } from 'vitest';

import prisma from '#config/prismaClient.js';

import { api, authedApi, cookieValue } from '../helpers/auth.js';
import { createUser, TEST_PASSWORD } from '../helpers/factories.js';

describe('POST /api/v1/auth/register-user', () => {
  const payload = {
    address: '12 Harbour Road, Accra',
    email: 'new-user@test.local',
    name: 'New User',
    password: 'Password1!',
  };

  it('registers a customer and sets auth cookies', async () => {
    const res = await api().post('/api/v1/auth/register-user').send(payload);

    expect(res.status).toBe(201);
    expect(res.body.data.email).toBe(payload.email);
    expect(res.body.data.password).toBeUndefined();
    expect(cookieValue(res, 'accessToken')).toBeTruthy();
    expect(cookieValue(res, 'refreshToken')).toBeTruthy();
  });

  it('forces public signups to the CUSTOMER role', async () => {
    const res = await api()
      .post('/api/v1/auth/register-user')
      .send({ ...payload, role: 'ADMIN' });

    expect(res.status).toBe(201);
    expect(res.body.data.role).toBe('CUSTOMER');
  });

  it('rejects a duplicate email', async () => {
    await createUser({ email: payload.email });
    const res = await api().post('/api/v1/auth/register-user').send(payload);
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it('rejects an invalid payload', async () => {
    const res = await api()
      .post('/api/v1/auth/register-user')
      .send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/v1/auth/login', () => {
  it('logs in with valid credentials and sets both cookies', async () => {
    const user = await createUser();

    const res = await api()
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(user.email);
    expect(res.body.data.password).toBeUndefined();
    expect(cookieValue(res, 'accessToken')).toBeTruthy();
    expect(cookieValue(res, 'refreshToken')).toBeTruthy();
  });

  it('rejects a wrong password with 401', async () => {
    const user = await createUser();
    const res = await api()
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'WrongPassword1!' });
    expect(res.status).toBe(401);
  });

  // Hardened: unknown email and wrong password return the SAME uniform 401,
  // so responses no longer leak which emails have an account.
  it('rejects an unknown email with the same 401 (no enumeration)', async () => {
    const res = await api()
      .post('/api/v1/auth/login')
      .send({ email: 'ghost@test.local', password: TEST_PASSWORD });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid credentials');
  });

  it('locks the account after 5 failed attempts (even for the right password)', async () => {
    const user = await createUser();

    for (let i = 0; i < 5; i++) {
      const res = await api()
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: 'WrongPassword1!' });
      expect(res.status).toBe(401);
    }

    // The lock refuses even correct credentials while it lasts.
    const locked = await api()
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: TEST_PASSWORD });
    expect(locked.status).toBe(429);

    const row = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(row.lockedUntil).not.toBeNull();
  });

  it('resets the failure counter on a successful login', async () => {
    const user = await createUser();

    for (let i = 0; i < 3; i++) {
      await api()
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: 'WrongPassword1!' });
    }

    const ok = await api()
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: TEST_PASSWORD });
    expect(ok.status).toBe(200);

    const row = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(row.failedLoginAttempts).toBe(0);
  });
});

describe('POST /api/v1/auth/refresh-token', () => {
  it('issues fresh cookies for a logged-in user', async () => {
    const user = await createUser();
    const login = await api()
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: TEST_PASSWORD });

    const cookies = [
      `accessToken=${cookieValue(login, 'accessToken')}`,
      `refreshToken=${cookieValue(login, 'refreshToken')}`,
    ].join('; ');

    const res = await api()
      .post('/api/v1/auth/refresh-token')
      .set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(cookieValue(res, 'accessToken')).toBeTruthy();
    expect(cookieValue(res, 'refreshToken')).toBeTruthy();
  });

  it('rejects a refresh without cookies', async () => {
    const res = await api().post('/api/v1/auth/refresh-token');
    expect(res.status).toBe(401);
  });

  it('rotates: the spent refresh token is dead, the new one works', async () => {
    const user = await createUser();
    const login = await api()
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: TEST_PASSWORD });
    const firstRefresh = cookieValue(login, 'refreshToken');

    // Exchange the first token — this consumes its rotation id.
    const rotated = await api()
      .post('/api/v1/auth/refresh-token')
      .set('Cookie', `refreshToken=${firstRefresh}`);
    expect(rotated.status).toBe(200);
    const secondRefresh = cookieValue(rotated, 'refreshToken');
    expect(secondRefresh).not.toBe(firstRefresh);

    // Replaying the spent token is refused (benign tab-race window: no
    // global sign-out) …
    const replay = await api()
      .post('/api/v1/auth/refresh-token')
      .set('Cookie', `refreshToken=${firstRefresh}`);
    expect(replay.status).toBe(401);

    // … while the freshly issued token still exchanges fine.
    const again = await api()
      .post('/api/v1/auth/refresh-token')
      .set('Cookie', `refreshToken=${secondRefresh}`);
    expect(again.status).toBe(200);
  });

  it('bumps the session epoch when a spent token is replayed after the grace window', async () => {
    const user = await createUser();
    const login = await api()
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: TEST_PASSWORD });
    const firstRefresh = cookieValue(login, 'refreshToken');
    const accessToken = cookieValue(login, 'accessToken');

    const rotated = await api()
      .post('/api/v1/auth/refresh-token')
      .set('Cookie', `refreshToken=${firstRefresh}`);
    expect(rotated.status).toBe(200);

    // Age the consumption past the 30s tab-race grace window, then replay:
    // this is the theft signature, so every session must die.
    const before = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    await prisma.userSecurityToken.updateMany({
      data: { consumedAt: new Date(Date.now() - 60_000) },
      where: { consumedAt: { not: null }, type: 'REFRESH', userId: user.id },
    });
    const replay = await api()
      .post('/api/v1/auth/refresh-token')
      .set('Cookie', `refreshToken=${firstRefresh}`);
    expect(replay.status).toBe(401);

    const after = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(after.tokenVersion).toBe(before.tokenVersion + 1);

    // The epoch bump killed the legitimately rotated refresh session too …
    const victim = await api()
      .post('/api/v1/auth/refresh-token')
      .set('Cookie', `refreshToken=${cookieValue(rotated, 'refreshToken')}`);
    expect(victim.status).toBe(401);

    // … and revoked the still-unexpired ACCESS token issued at login.
    const revoked = await api()
      .get('/api/v1/tours')
      .set('Cookie', `accessToken=${accessToken}`);
    expect(revoked.status).toBe(401);
  });

  it('kills refresh when the session epoch is bumped server-side', async () => {
    const user = await createUser();
    const login = await api()
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: TEST_PASSWORD });

    await prisma.user.update({
      data: { tokenVersion: { increment: 1 } },
      where: { id: user.id },
    });

    const res = await api()
      .post('/api/v1/auth/refresh-token')
      .set('Cookie', `refreshToken=${cookieValue(login, 'refreshToken')}`);
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/auth/logout', () => {
  it('clears the auth cookies', async () => {
    const user = await createUser();
    const login = await api()
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: TEST_PASSWORD });

    const res = await api()
      .post('/api/v1/auth/logout')
      .set('Cookie', `accessToken=${cookieValue(login, 'accessToken')}`);

    expect(res.status).toBe(200);
    // Cleared cookies come back as empty values
    expect(cookieValue(res, 'accessToken')).toBeUndefined();
    expect(cookieValue(res, 'refreshToken')).toBeUndefined();
  });

  it('consumes the presented refresh token so it cannot be exchanged again', async () => {
    const user = await createUser();
    const login = await api()
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: TEST_PASSWORD });
    const refreshToken = cookieValue(login, 'refreshToken');

    const res = await api()
      .post('/api/v1/auth/logout')
      .set('Cookie', `refreshToken=${refreshToken}`);
    expect(res.status).toBe(200);

    const replay = await api()
      .post('/api/v1/auth/refresh-token')
      .set('Cookie', `refreshToken=${refreshToken}`);
    expect(replay.status).toBe(401);
  });
});

describe('authentication gate', () => {
  it('rejects protected routes without a token', async () => {
    const res = await api().get('/api/v1/tours');
    expect(res.status).toBe(401);
  });

  it('rejects a garbage token', async () => {
    const res = await api()
      .get('/api/v1/tours')
      .set('Cookie', 'accessToken=not-a-jwt');
    expect(res.status).toBe(401);
  });

  it('accepts a valid token', async () => {
    const user = await createUser();
    const res = await authedApi(user).get('/api/v1/tours');
    expect(res.status).toBe(200);
  });
});
