// test/integration/auth-features.test.ts
//
// Auth features: minimal signup (name + email OR phone, password
// optional), passwordless OTP login over email/SMS (enumeration-safe request,
// capped verify attempts, single-use codes), forgot/reset password (opaque
// single-use link token, session-epoch bump kills every live session), Google
// sign-in (service-level with a fake google dep + the HTTP 503 gate), and the
// payment guard for accounts without an email. Outbound mail/SMS are mocked
// in test/setup.ts; codes and links are read back via test/helpers/messages.
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ENV from '#config/env.js';
import prisma from '#config/prismaClient.js';
import { systemClock } from '#lib/clock.js';
import { makeAuthService } from '#services/auth.service.js';
import { type AppConfig, type GoogleAuthClient } from '#services/deps.js';
import logger from '#utils/logger.js';

import { api, authedApi, cookieValue } from '../helpers/auth.js';
import {
  createAgent,
  createCustomer,
  createTour,
  TEST_PASSWORD,
} from '../helpers/factories.js';
import {
  clearMessages,
  lastEmailTo,
  otpFromEmail,
  otpFromSms,
  resetTokenFromEmail,
  sentEmails,
  sentSms,
} from '../helpers/messages.js';

beforeEach(() => {
  clearMessages();
});

// ---------------------------------------------------------------- signup ---

describe('POST /api/v1/auth/register-user (minimal signup)', () => {
  it('registers with only name + email and sets auth cookies', async () => {
    const res = await api()
      .post('/api/v1/auth/register-user')
      .send({ email: 'minimal@test.local', name: 'Minimal User' });

    expect(res.status).toBe(201);
    expect(res.body.data.email).toBe('minimal@test.local');
    // Customers have no role; the DTO carries none.
    expect(res.body.data.role).toBeUndefined();
    expect(res.body.data.password).toBeUndefined();
    expect(cookieValue(res, 'accessToken')).toBeTruthy();
    expect(cookieValue(res, 'refreshToken')).toBeTruthy();

    const row = await prisma.customer.findUniqueOrThrow({
      where: { email: 'minimal@test.local' },
    });
    expect(row.password).toBeNull();
  });

  it('registers with only name + phone and sets auth cookies', async () => {
    const res = await api()
      .post('/api/v1/auth/register-user')
      .send({ name: 'Phone Only', phone: '233550009999' });

    expect(res.status).toBe(201);
    expect(res.body.data.phone).toBe('233550009999');
    expect(res.body.data.email).toBeUndefined();
    expect(cookieValue(res, 'accessToken')).toBeTruthy();
    expect(cookieValue(res, 'refreshToken')).toBeTruthy();

    const row = await prisma.customer.findUniqueOrThrow({
      where: { phone: '233550009999' },
    });
    expect(row.email).toBeNull();
    expect(row.password).toBeNull();
  });

  it('still hashes a password when one is provided', async () => {
    const res = await api().post('/api/v1/auth/register-user').send({
      email: 'with-password@test.local',
      name: 'With Password',
      password: 'Password1!',
    });
    expect(res.status).toBe(201);

    const row = await prisma.customer.findUniqueOrThrow({
      where: { email: 'with-password@test.local' },
    });
    expect(row.password).not.toBeNull();
    expect(row.password).not.toBe('Password1!');
  });

  it('rejects a signup with neither email nor phone', async () => {
    const res = await api()
      .post('/api/v1/auth/register-user')
      .send({ name: 'No Contact' });
    expect(res.status).toBe(400);
  });

  it('refuses password login for a passwordless account with a uniform 401', async () => {
    await api()
      .post('/api/v1/auth/register-user')
      .send({ email: 'no-password@test.local', name: 'No Password' });

    const res = await api()
      .post('/api/v1/auth/login')
      .send({ email: 'no-password@test.local', password: 'AnyPassword1!' });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid credentials');
  });
});

// ------------------------------------------------------------- OTP login ---

/** A wrong-but-well-formed code for the given right one. */
const wrongCode = (code: string): string =>
  code === '000000' ? '000001' : '000000';

describe('POST /api/v1/auth/otp/{request,verify}', () => {
  it('logs in via an emailed code (cookies set, code single-use)', async () => {
    const customer = await createCustomer();

    const requested = await api()
      .post('/api/v1/auth/otp/request')
      .send({ email: customer.email });
    expect(requested.status).toBe(200);

    const code = otpFromEmail(customer.email!);
    const verified = await api()
      .post('/api/v1/auth/otp/verify')
      .send({ code, email: customer.email });

    expect(verified.status).toBe(200);
    expect(verified.body.data.id).toBe(customer.id);
    expect(verified.body.data.password).toBeUndefined();
    expect(cookieValue(verified, 'accessToken')).toBeTruthy();
    expect(cookieValue(verified, 'refreshToken')).toBeTruthy();

    // The code was consumed — replaying it is refused.
    const replay = await api()
      .post('/api/v1/auth/otp/verify')
      .send({ code, email: customer.email });
    expect(replay.status).toBe(401);
  });

  it('logs in via an SMS code for a phone contact', async () => {
    const customer = await createCustomer({ phone: '233550008888' });

    const requested = await api()
      .post('/api/v1/auth/otp/request')
      .send({ phone: '233550008888' });
    expect(requested.status).toBe(200);
    // The code went out over SMS, not email.
    expect(lastEmailTo(customer.email!)).toBeUndefined();

    const code = otpFromSms('233550008888');
    const verified = await api()
      .post('/api/v1/auth/otp/verify')
      .send({ code, phone: '233550008888' });

    expect(verified.status).toBe(200);
    expect(verified.body.data.id).toBe(customer.id);
    expect(cookieValue(verified, 'accessToken')).toBeTruthy();
  });

  it('resets the password-failure counter on a successful OTP login', async () => {
    const customer = await createCustomer();
    await prisma.customer.update({
      data: { failedLoginAttempts: 3 },
      where: { id: customer.id },
    });

    await api().post('/api/v1/auth/otp/request').send({ email: customer.email });
    const code = otpFromEmail(customer.email!);
    const verified = await api()
      .post('/api/v1/auth/otp/verify')
      .send({ code, email: customer.email });
    expect(verified.status).toBe(200);

    const row = await prisma.customer.findUniqueOrThrow({
      where: { id: customer.id },
    });
    expect(row.failedLoginAttempts).toBe(0);
  });

  it('rejects a wrong code with a uniform 401 and caps attempts at 5', async () => {
    const customer = await createCustomer();
    await api().post('/api/v1/auth/otp/request').send({ email: customer.email });
    const code = otpFromEmail(customer.email!);

    for (let i = 0; i < 5; i++) {
      const res = await api()
        .post('/api/v1/auth/otp/verify')
        .send({ code: wrongCode(code), email: customer.email });
      expect(res.status).toBe(401);
      expect(res.body.message).toBe(
        'Your code is invalid or has expired. Request a new one.',
      );
    }

    // The cap killed the code: even the RIGHT one is refused now.
    const dead = await api()
      .post('/api/v1/auth/otp/verify')
      .send({ code, email: customer.email });
    expect(dead.status).toBe(401);
  });

  it('answers 200 for an unknown contact without sending anything', async () => {
    const res = await api()
      .post('/api/v1/auth/otp/request')
      .send({ email: 'ghost@test.local' });

    expect(res.status).toBe(200);
    // Same body as a known contact; nothing actually went out.
    expect(res.body.message).toBe(
      'If an account exists for that contact, a login code is on its way.',
    );
    expect(sentEmails()).toHaveLength(0);
    expect(sentSms()).toHaveLength(0);
  });

  it('silently drops a re-request inside the 60s cooldown (no enumeration)', async () => {
    const customer = await createCustomer();

    const first = await api()
      .post('/api/v1/auth/otp/request')
      .send({ email: customer.email });
    expect(first.status).toBe(200);

    // A 429 here would only ever fire for existing accounts, leaking
    // existence — the cooldown must answer exactly like the unknown-contact
    // path and just not send.
    const second = await api()
      .post('/api/v1/auth/otp/request')
      .send({ email: customer.email });
    expect(second.status).toBe(200);
    expect(second.body.message).toBe(
      'If an account exists for that contact, a login code is on its way.',
    );
    // Only the first request produced an email.
    expect(sentEmails()).toHaveLength(1);
  });

  it('rejects a verify for an account that never requested a code', async () => {
    const customer = await createCustomer();
    const res = await api()
      .post('/api/v1/auth/otp/verify')
      .send({ code: '123456', email: customer.email });
    expect(res.status).toBe(401);
  });

  it('rejects a request naming both email and phone', async () => {
    const customer = await createCustomer();
    const res = await api()
      .post('/api/v1/auth/otp/request')
      .send({ email: customer.email, phone: customer.phone });
    expect(res.status).toBe(400);
  });
});

// -------------------------------------------------------- password reset ---

describe('POST /api/v1/auth/{forgot,reset}-password', () => {
  it('resets the password via the emailed link and kills every session', async () => {
    const customer = await createCustomer();
    const login = await api()
      .post('/api/v1/auth/login')
      .send({ email: customer.email, password: TEST_PASSWORD });
    const refreshToken = cookieValue(login, 'refreshToken');

    const forgot = await api()
      .post('/api/v1/auth/forgot-password')
      .send({ email: customer.email });
    expect(forgot.status).toBe(200);

    // The emailed link carries the raw token and points at the frontend.
    expect(lastEmailTo(customer.email!)?.text).toContain(
      `${ENV.FRONTEND_URL}/reset-password?token=`,
    );
    const token = resetTokenFromEmail(customer.email!);

    const reset = await api()
      .post('/api/v1/auth/reset-password')
      .send({ password: 'BrandNew9!', token });
    expect(reset.status).toBe(200);

    // tokenVersion bump: the pre-reset session's refresh token is dead.
    const refresh = await api()
      .post('/api/v1/auth/refresh-token')
      .set('Cookie', `refreshToken=${refreshToken}`);
    expect(refresh.status).toBe(401);

    // Old password refused, new one accepted.
    const oldLogin = await api()
      .post('/api/v1/auth/login')
      .send({ email: customer.email, password: TEST_PASSWORD });
    expect(oldLogin.status).toBe(401);
    const newLogin = await api()
      .post('/api/v1/auth/login')
      .send({ email: customer.email, password: 'BrandNew9!' });
    expect(newLogin.status).toBe(200);
  });

  it('resets a STAFF password too (the reset token FKs the staff row)', async () => {
    const agent = await createAgent();

    const forgot = await api()
      .post('/api/v1/auth/forgot-password')
      .send({ email: agent.email });
    expect(forgot.status).toBe(200);

    const token = resetTokenFromEmail(agent.email!);
    const reset = await api()
      .post('/api/v1/auth/reset-password')
      .send({ password: 'StaffNew9!', token });
    expect(reset.status).toBe(200);

    // The token row was FK'd to the staff principal, not a customer.
    const record = await prisma.userSecurityToken.findFirstOrThrow({
      where: { type: 'PASSWORD_RESET' },
    });
    expect(record.userId).toBe(agent.id);
    expect(record.customerId).toBeNull();

    // Old password refused, new one accepted — still a staff login.
    const oldLogin = await api()
      .post('/api/v1/auth/login')
      .send({ email: agent.email, password: TEST_PASSWORD });
    expect(oldLogin.status).toBe(401);
    const newLogin = await api()
      .post('/api/v1/auth/login')
      .send({ email: agent.email, password: 'StaffNew9!' });
    expect(newLogin.status).toBe(200);
    expect(newLogin.body.data.role).toBe('AGENT');
  });

  it('answers 200 for an unknown email without sending anything', async () => {
    const res = await api()
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'ghost@test.local' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe(
      'If an account exists for that email, a password reset link is on its way.',
    );
    expect(sentEmails()).toHaveLength(0);
  });

  it('reset tokens are single-use', async () => {
    const customer = await createCustomer();
    await api()
      .post('/api/v1/auth/forgot-password')
      .send({ email: customer.email });
    const token = resetTokenFromEmail(customer.email!);

    const first = await api()
      .post('/api/v1/auth/reset-password')
      .send({ password: 'BrandNew9!', token });
    expect(first.status).toBe(200);

    const replay = await api()
      .post('/api/v1/auth/reset-password')
      .send({ password: 'Another9!', token });
    expect(replay.status).toBe(401);
  });

  it('rejects a garbage reset token with 401', async () => {
    const res = await api()
      .post('/api/v1/auth/reset-password')
      .send({ password: 'BrandNew9!', token: 'f'.repeat(64) });
    expect(res.status).toBe(401);
  });

  it('a fresh forgot-password invalidates the previous unconsumed link', async () => {
    const customer = await createCustomer();
    await api()
      .post('/api/v1/auth/forgot-password')
      .send({ email: customer.email });
    const firstToken = resetTokenFromEmail(customer.email!);

    await api()
      .post('/api/v1/auth/forgot-password')
      .send({ email: customer.email });
    const secondToken = resetTokenFromEmail(customer.email!);
    expect(secondToken).not.toBe(firstToken);

    const stale = await api()
      .post('/api/v1/auth/reset-password')
      .send({ password: 'BrandNew9!', token: firstToken });
    expect(stale.status).toBe(401);

    const fresh = await api()
      .post('/api/v1/auth/reset-password')
      .send({ password: 'BrandNew9!', token: secondToken });
    expect(fresh.status).toBe(200);
  });
});

// --------------------------------------------------------- Google sign-in ---

/** The auth service with a FAKE google dep (and a configured client id). */
const makeGoogleService = (google: GoogleAuthClient) => {
  const config: AppConfig = {
    ACCESS_TOKEN_EXPIRY: ENV.ACCESS_TOKEN_EXPIRY,
    ACCESS_TOKEN_SECRET: ENV.ACCESS_TOKEN_SECRET,
    DEMO_LOGIN_ENABLED: false,
    FRONTEND_URL: ENV.FRONTEND_URL,
    GOOGLE_CLIENT_ID: 'test-google-client-id',
    REFRESH_TOKEN_EXPIRY: ENV.REFRESH_TOKEN_EXPIRY,
    REFRESH_TOKEN_SECRET: ENV.REFRESH_TOKEN_SECRET,
  };
  return makeAuthService({
    clock: systemClock,
    config,
    google,
    logger,
    notify: { email: vi.fn(), sms: vi.fn() },
    prisma,
  });
};

describe('googleSignIn (service, fake google dep)', () => {
  const identity = {
    email: 'google-user@test.local',
    emailVerified: true,
    googleId: 'google-sub-1',
    name: 'Google User',
  };

  it('creates a passwordless Customer for a brand-new identity', async () => {
    const service = makeGoogleService({
      verifyIdToken: vi.fn(() => Promise.resolve(identity)),
    });

    const customer = await service.googleSignIn('a-valid-token');

    expect(customer.email).toBe(identity.email);
    expect(customer.googleId).toBe(identity.googleId);
    expect(customer.name).toBe(identity.name);
    expect(customer.password).toBeNull();

    // Second sign-in resolves the SAME account by googleId; nothing lands in
    // the staff table.
    const again = await service.googleSignIn('a-valid-token');
    expect(again.id).toBe(customer.id);
    expect(await prisma.customer.count()).toBe(1);
    expect(await prisma.user.count()).toBe(0);
  });

  it('links the googleId to an existing account with the verified email', async () => {
    const existing = await createCustomer({ email: identity.email });
    const service = makeGoogleService({
      verifyIdToken: vi.fn(() => Promise.resolve(identity)),
    });

    const customer = await service.googleSignIn('a-valid-token');

    expect(customer.id).toBe(existing.id);
    const row = await prisma.customer.findUniqueOrThrow({
      where: { id: existing.id },
    });
    expect(row.googleId).toBe(identity.googleId);
  });

  it('rejects an unverifiable token with 401', async () => {
    const service = makeGoogleService({
      verifyIdToken: vi.fn(() => Promise.resolve(null)),
    });
    await expect(service.googleSignIn('garbage')).rejects.toMatchObject({
      status: 401,
    });
  });

  it('refuses to link or create from an UNVERIFIED Google email', async () => {
    await createCustomer({ email: identity.email });
    const service = makeGoogleService({
      verifyIdToken: vi.fn(() =>
        Promise.resolve({ ...identity, emailVerified: false }),
      ),
    });
    await expect(service.googleSignIn('a-valid-token')).rejects.toMatchObject({
      status: 401,
    });
  });
});

describe('POST /api/v1/auth/google (unconfigured)', () => {
  it('responds 503 when GOOGLE_CLIENT_ID is not set', async () => {
    const res = await api()
      .post('/api/v1/auth/google')
      .send({ idToken: 'anything' });
    expect(res.status).toBe(503);
    expect(res.body.message).toBe('Google sign-in is not configured');
  });
});

// -------------------------------------------------- payments need an email ---

describe('POST /api/v1/payments without an email on file', () => {
  it('refuses to initialize a Paystack payment with 400', async () => {
    const customer = await prisma.customer.create({
      data: { name: 'Phone Payer', phone: '233550007777' },
    });
    const tour = await createTour({ price: 300 });
    const booking = await prisma.booking.create({
      data: {
        customerId: customer.id,
        numberOfGuests: 1,
        totalPrice: 300,
        tourId: tour.id,
      },
    });

    const res = await authedApi(customer)
      .post('/api/v1/payments')
      .send({ bookingId: booking.id, paymentMethod: 'CREDIT_CARD' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe(
      'An email address is required for online payment; please add one to your profile',
    );
    // No Payment row was created.
    expect(await prisma.payment.count()).toBe(0);
  });
});
