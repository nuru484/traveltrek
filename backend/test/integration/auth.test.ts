// test/integration/auth.test.ts
//
// Baseline behaviour of the authentication flows BEFORE the service-layer
// refactor. These tests pin current behaviour (including known quirks noted
// inline) so the refactor can prove it changed nothing unintentionally.
import { describe, expect, it } from 'vitest';

import { api, authedApi, cookieValue } from '../helpers/auth';
import { createUser, TEST_PASSWORD } from '../helpers/factories';

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

  // Known quirk (fixed in the auth-hardening phase): unknown emails currently
  // return 404, which leaks account existence. This pins today's behaviour.
  it('rejects an unknown email with 404 (current behaviour)', async () => {
    const res = await api()
      .post('/api/v1/auth/login')
      .send({ email: 'ghost@test.local', password: TEST_PASSWORD });
    expect(res.status).toBe(404);
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
