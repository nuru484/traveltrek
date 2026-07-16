// test/integration/change-password.test.ts
//
// POST /api/v1/auth/change-password — the ONLY password-writing surface for
// existing accounts (profile updates strip the field, admin creation is
// passwordless). Covers both modes (first-set for passwordless accounts,
// verified rotation otherwise), the uniform-401 + lockout-counter discipline
// for wrong currentPassword, and the session semantics: every OTHER session
// dies (epoch bump kills the old refresh token) while THIS session stays
// signed in on freshly re-issued cookies.
import { describe, expect, it } from 'vitest';

import prisma from '#config/prismaClient.js';

import { api, authedApi, cookieValue } from '../helpers/auth.js';
import {
  createAdmin,
  createAgent,
  createCustomer,
  TEST_PASSWORD,
} from '../helpers/factories.js';

const CHANGE_URL = '/api/v1/auth/change-password';

describe('POST /api/v1/auth/change-password', () => {
  it('requires authentication', async () => {
    const res = await api()
      .post(CHANGE_URL)
      .send({ newPassword: 'BrandNew9!' });
    expect(res.status).toBe(401);
  });

  it('sets a FIRST password for a passwordless customer (no currentPassword)', async () => {
    const customer = await createCustomer({ password: null });

    const res = await authedApi(customer)
      .post(CHANGE_URL)
      .send({ newPassword: 'FirstPass9!' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Password changed successfully.');
    // The caller stays signed in on freshly minted cookies.
    expect(cookieValue(res, 'accessToken')).toBeTruthy();
    expect(cookieValue(res, 'refreshToken')).toBeTruthy();

    // The password is now a real credential.
    const login = await api()
      .post('/api/v1/auth/login')
      .send({ email: customer.email, password: 'FirstPass9!' });
    expect(login.status).toBe(200);
  });

  it('rejects a currentPassword on a passwordless account with 400', async () => {
    const customer = await createCustomer({ password: null });

    const res = await authedApi(customer)
      .post(CHANGE_URL)
      .send({ currentPassword: 'Anything1!', newPassword: 'FirstPass9!' });

    expect(res.status).toBe(400);
    const row = await prisma.customer.findUniqueOrThrow({
      where: { id: customer.id },
    });
    expect(row.password).toBeNull();
  });

  it('requires currentPassword when the account has a password (400)', async () => {
    const customer = await createCustomer();

    const res = await authedApi(customer)
      .post(CHANGE_URL)
      .send({ newPassword: 'BrandNew9!' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe(
      'Current password is required to change your password.',
    );
  });

  it('answers a wrong currentPassword with the uniform 401 and feeds the lockout counter', async () => {
    const customer = await createCustomer();

    const res = await authedApi(customer)
      .post(CHANGE_URL)
      .send({ currentPassword: 'WrongPassword1!', newPassword: 'BrandNew9!' });

    // Same status + message as a failed login — and the same counter.
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid credentials');
    const row = await prisma.customer.findUniqueOrThrow({
      where: { id: customer.id },
    });
    expect(row.failedLoginAttempts).toBe(1);
    expect(row.password).toBe(customer.password);
  });

  it('locks the account at the threshold, then refuses even the right password with 429', async () => {
    const customer = await createCustomer();
    // Four failures are already on the books (e.g. from /auth/login).
    await prisma.customer.update({
      data: { failedLoginAttempts: 4 },
      where: { id: customer.id },
    });

    // The fifth wrong guess crosses the threshold and locks the account.
    const fifth = await authedApi(customer)
      .post(CHANGE_URL)
      .send({ currentPassword: 'WrongPassword1!', newPassword: 'BrandNew9!' });
    expect(fifth.status).toBe(401);
    const locked = await prisma.customer.findUniqueOrThrow({
      where: { id: customer.id },
    });
    expect(locked.lockedUntil).not.toBeNull();

    // While locked, even the CORRECT current password is refused.
    const duringLock = await authedApi(customer)
      .post(CHANGE_URL)
      .send({ currentPassword: TEST_PASSWORD, newPassword: 'BrandNew9!' });
    expect(duringLock.status).toBe(429);
  });

  it('rotates the password, re-issues THIS session and kills every other one', async () => {
    const customer = await createCustomer();

    // A real login session whose refresh token should die on rotation.
    const login = await api()
      .post('/api/v1/auth/login')
      .send({ email: customer.email, password: TEST_PASSWORD });
    const oldRefresh = cookieValue(login, 'refreshToken');
    expect(oldRefresh).toBeTruthy();

    const res = await authedApi(customer)
      .post(CHANGE_URL)
      .send({ currentPassword: TEST_PASSWORD, newPassword: 'Rotated9!' });
    expect(res.status).toBe(200);

    // Fresh cookies for the caller — and they actually work (new epoch).
    const newAccess = cookieValue(res, 'accessToken');
    const newRefresh = cookieValue(res, 'refreshToken');
    expect(newAccess).toBeTruthy();
    expect(newRefresh).toBeTruthy();
    const me = await api()
      .get(`/api/v1/customers/${String(customer.id)}`)
      .set('Cookie', `accessToken=${String(newAccess)}`);
    expect(me.status).toBe(200);
    const refreshed = await api()
      .post('/api/v1/auth/refresh-token')
      .set('Cookie', `refreshToken=${String(newRefresh)}`);
    expect(refreshed.status).toBe(200);

    // The pre-change session is dead: its refresh token carries the old
    // epoch (and its registration was swept).
    const stale = await api()
      .post('/api/v1/auth/refresh-token')
      .set('Cookie', `refreshToken=${String(oldRefresh)}`);
    expect(stale.status).toBe(401);

    // Old password refused, new one accepted.
    const oldLogin = await api()
      .post('/api/v1/auth/login')
      .send({ email: customer.email, password: TEST_PASSWORD });
    expect(oldLogin.status).toBe(401);
    const newLogin = await api()
      .post('/api/v1/auth/login')
      .send({ email: customer.email, password: 'Rotated9!' });
    expect(newLogin.status).toBe(200);
  });

  it('works for STAFF principals too (rotation against the User table)', async () => {
    const agent = await createAgent();

    const res = await authedApi(agent)
      .post(CHANGE_URL)
      .send({ currentPassword: TEST_PASSWORD, newPassword: 'StaffNew9!' });
    expect(res.status).toBe(200);

    const login = await api()
      .post('/api/v1/auth/login')
      .send({ email: agent.email, password: 'StaffNew9!' });
    expect(login.status).toBe(200);
    expect(login.body.data.role).toBe('AGENT');
  });

  it('lets an admin-created (passwordless) staffer set their first password', async () => {
    const admin = await createAdmin();
    const created = await authedApi(admin).post('/api/v1/users').send({
      address: '1 Fresh Hire Road',
      email: 'fresh-hire@test.local',
      name: 'Fresh Hire',
      role: 'AGENT',
    });
    expect(created.status).toBe(201);
    const staffId = created.body.data.id as number;

    const res = await authedApi({ id: staffId, role: 'AGENT' })
      .post(CHANGE_URL)
      .send({ newPassword: 'HiredPass9!' });
    expect(res.status).toBe(200);

    const login = await api()
      .post('/api/v1/auth/login')
      .send({ email: 'fresh-hire@test.local', password: 'HiredPass9!' });
    expect(login.status).toBe(200);
  });
});
