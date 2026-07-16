// test/integration/two-factor.test.ts
//
// Two-factor authentication over both principals (khadys pattern, adapted to
// kind-tagged JWTs and email/SMS channels). Covers: the enable handshake
// (authed challenge + code), password login answering twoFactorRequired with
// the pending cookie and NO auth cookies, verify completing the login with
// the normal envelope, the wrong-code attempts cap, the silent resend
// cooldown, disable (same challenge+code proof), the no-channel 400, and the
// DOCUMENTED bypasses: OTP login and Google sign-in are single-possession-
// factor flows and never ask for a second code.
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ENV from '#config/env.js';
import prisma, { TokenType } from '#config/prismaClient.js';
import { systemClock } from '#lib/clock.js';
import { makeAuthService } from '#services/auth.service.js';
import { type GoogleAuthClient } from '#services/deps.js';
import logger from '#utils/logger.js';

import { api, authedApi, cookieValue } from '../helpers/auth.js';
import {
  createAgent,
  createCustomer,
  TEST_PASSWORD,
} from '../helpers/factories.js';
import {
  clearMessages,
  otpFromEmail,
  otpFromSms,
  sentEmails,
  sentSms,
} from '../helpers/messages.js';

beforeEach(() => {
  clearMessages();
});

/** A wrong-but-well-formed code for the given right one. */
const wrongCode = (code: string): string =>
  code === '000000' ? '000001' : '000000';

/** Backdates every TWO_FACTOR token past the 60s issue cooldown so a test
 * can request the next challenge without literally waiting. */
const expireTwoFactorCooldown = async (): Promise<void> => {
  await prisma.userSecurityToken.updateMany({
    data: { createdAt: new Date(Date.now() - 61_000) },
    where: { type: TokenType.TWO_FACTOR },
  });
};

/** Enables 2FA for a principal over the HTTP surface (challenge + code). */
const enableTwoFactorFor = async (
  principal: Parameters<typeof authedApi>[0] & { email: null | string },
): Promise<void> => {
  const challenged = await authedApi(principal).post('/api/v1/auth/2fa/challenge');
  expect(challenged.status).toBe(200);
  const code = otpFromEmail(principal.email ?? '');
  const enabled = await authedApi(principal)
    .post('/api/v1/auth/2fa/enable')
    .send({ code });
  expect(enabled.status).toBe(200);
};

describe('2FA management: /api/v1/auth/2fa/{challenge,enable,disable,status}', () => {
  it('requires a full session', async () => {
    for (const path of ['challenge', 'enable', 'disable'] as const) {
      const res = await api()
        .post(`/api/v1/auth/2fa/${path}`)
        .send({ code: '123456' });
      expect(res.status).toBe(401);
    }
    expect((await api().get('/api/v1/auth/2fa/status')).status).toBe(401);
  });

  it('enables via challenge + emailed code and reports status', async () => {
    const customer = await createCustomer();

    const before = await authedApi(customer).get('/api/v1/auth/2fa/status');
    expect(before.status).toBe(200);
    expect(before.body.data).toEqual({ channel: 'email', enabled: false });

    await enableTwoFactorFor(customer);

    const row = await prisma.customer.findUniqueOrThrow({
      where: { id: customer.id },
    });
    expect(row.twoFactorEnabled).toBe(true);

    const after = await authedApi(customer).get('/api/v1/auth/2fa/status');
    expect(after.body.data).toEqual({ channel: 'email', enabled: true });
  });

  it('uses SMS for a phone-only account (no email on file)', async () => {
    const customer = await prisma.customer.create({
      data: { name: 'Phone Only 2FA', phone: '233550006666' },
    });

    const challenged = await authedApi({
      id: customer.id,
      kind: 'customer',
    }).post('/api/v1/auth/2fa/challenge');
    expect(challenged.status).toBe(200);
    expect(sentEmails()).toHaveLength(0);

    const code = otpFromSms('233550006666');
    const enabled = await authedApi({ id: customer.id, kind: 'customer' })
      .post('/api/v1/auth/2fa/enable')
      .send({ code });
    expect(enabled.status).toBe(200);

    const status = await authedApi({ id: customer.id, kind: 'customer' }).get(
      '/api/v1/auth/2fa/status',
    );
    expect(status.body.data).toEqual({ channel: 'sms', enabled: true });
  });

  it('refuses to challenge an account with neither email nor phone (400)', async () => {
    const customer = await prisma.customer.create({
      data: { name: 'No Channel' },
    });

    const res = await authedApi({ id: customer.id, kind: 'customer' }).post(
      '/api/v1/auth/2fa/challenge',
    );
    expect(res.status).toBe(400);
    expect(res.body.message).toBe(
      'Add an email address or phone number to your profile before using two-factor authentication.',
    );
    expect(sentEmails()).toHaveLength(0);
    expect(sentSms()).toHaveLength(0);
  });

  it('rejects enabling with a wrong code (uniform 401) and when already enabled (400)', async () => {
    const customer = await createCustomer();

    await authedApi(customer).post('/api/v1/auth/2fa/challenge');
    const code = otpFromEmail(customer.email ?? '');

    const bad = await authedApi(customer)
      .post('/api/v1/auth/2fa/enable')
      .send({ code: wrongCode(code) });
    expect(bad.status).toBe(401);

    const good = await authedApi(customer)
      .post('/api/v1/auth/2fa/enable')
      .send({ code });
    expect(good.status).toBe(200);

    const again = await authedApi(customer)
      .post('/api/v1/auth/2fa/enable')
      .send({ code });
    expect(again.status).toBe(400);
    expect(again.body.message).toBe(
      'Two-factor authentication is already enabled',
    );
  });

  it('disables with the same challenge + code proof', async () => {
    const customer = await createCustomer();
    await enableTwoFactorFor(customer);

    // Disabling without a live code is refused (the enable code is spent).
    const noCode = await authedApi(customer)
      .post('/api/v1/auth/2fa/disable')
      .send({ code: '123456' });
    expect(noCode.status).toBe(401);

    await expireTwoFactorCooldown();
    await authedApi(customer).post('/api/v1/auth/2fa/challenge');
    const code = otpFromEmail(customer.email ?? '');

    const disabled = await authedApi(customer)
      .post('/api/v1/auth/2fa/disable')
      .send({ code });
    expect(disabled.status).toBe(200);

    const row = await prisma.customer.findUniqueOrThrow({
      where: { id: customer.id },
    });
    expect(row.twoFactorEnabled).toBe(false);

    // Login issues a session directly again — no second factor asked.
    const login = await api()
      .post('/api/v1/auth/login')
      .send({ email: customer.email, password: TEST_PASSWORD });
    expect(login.status).toBe(200);
    expect(cookieValue(login, 'accessToken')).toBeTruthy();
  });

  it('refuses to disable when 2FA is not enabled (400)', async () => {
    const customer = await createCustomer();
    const res = await authedApi(customer)
      .post('/api/v1/auth/2fa/disable')
      .send({ code: '123456' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Two-factor authentication is not enabled');
  });
});

describe('2FA login: POST /api/v1/auth/login + /2fa/{verify,resend}', () => {
  /** Password-logs-in a 2FA customer up to the pending state. */
  const loginToPending = async (customer: {
    email: null | string;
  }): Promise<{ code: string; pending: string }> => {
    clearMessages();
    const login = await api()
      .post('/api/v1/auth/login')
      .send({ email: customer.email, password: TEST_PASSWORD });

    expect(login.status).toBe(200);
    expect(login.body.data).toEqual({ twoFactorRequired: true });
    // NO session and NO user object — only the pending proof.
    expect(cookieValue(login, 'accessToken')).toBeUndefined();
    expect(cookieValue(login, 'refreshToken')).toBeUndefined();
    const pending = cookieValue(login, 'twoFactorPending');
    expect(pending).toBeTruthy();

    return { code: otpFromEmail(customer.email ?? ''), pending: String(pending) };
  };

  it('withholds the session until the code verifies, then issues the normal envelope', async () => {
    const customer = await createCustomer();
    await enableTwoFactorFor(customer);
    await expireTwoFactorCooldown();

    const { code, pending } = await loginToPending(customer);

    const verified = await api()
      .post('/api/v1/auth/2fa/verify')
      .set('Cookie', `twoFactorPending=${pending}`)
      .send({ code });

    expect(verified.status).toBe(200);
    expect(verified.body.message).toBe('Login successful');
    expect(verified.body.data.id).toBe(customer.id);
    expect(verified.body.data.password).toBeUndefined();
    expect(cookieValue(verified, 'accessToken')).toBeTruthy();
    expect(cookieValue(verified, 'refreshToken')).toBeTruthy();
    // The pending proof is cleared with the success.
    expect(cookieValue(verified, 'twoFactorPending')).toBeUndefined();

    // The code was consumed — replaying it is refused.
    const replay = await api()
      .post('/api/v1/auth/2fa/verify')
      .set('Cookie', `twoFactorPending=${pending}`)
      .send({ code });
    expect(replay.status).toBe(401);
  });

  it('works for STAFF principals too', async () => {
    const agent = await createAgent();
    await enableTwoFactorFor(agent);
    await expireTwoFactorCooldown();

    const { code, pending } = await loginToPending(agent);
    const verified = await api()
      .post('/api/v1/auth/2fa/verify')
      .set('Cookie', `twoFactorPending=${pending}`)
      .send({ code });

    expect(verified.status).toBe(200);
    expect(verified.body.data.id).toBe(agent.id);
    expect(verified.body.data.role).toBe('AGENT');
    expect(cookieValue(verified, 'accessToken')).toBeTruthy();
  });

  it('rejects verify without the pending cookie (401)', async () => {
    const res = await api()
      .post('/api/v1/auth/2fa/verify')
      .send({ code: '123456' });
    expect(res.status).toBe(401);
  });

  it('rejects a garbage pending cookie (401) — access secrets do not verify it', async () => {
    const res = await api()
      .post('/api/v1/auth/2fa/verify')
      .set('Cookie', 'twoFactorPending=not-a-jwt')
      .send({ code: '123456' });
    expect(res.status).toBe(401);
  });

  it('caps wrong codes at 5 — then even the right one is dead', async () => {
    const customer = await createCustomer();
    await enableTwoFactorFor(customer);
    await expireTwoFactorCooldown();

    const { code, pending } = await loginToPending(customer);

    for (let i = 0; i < 5; i++) {
      const res = await api()
        .post('/api/v1/auth/2fa/verify')
        .set('Cookie', `twoFactorPending=${pending}`)
        .send({ code: wrongCode(code) });
      expect(res.status).toBe(401);
      expect(res.body.message).toBe(
        'Your code is invalid or has expired. Request a new one.',
      );
    }

    const dead = await api()
      .post('/api/v1/auth/2fa/verify')
      .set('Cookie', `twoFactorPending=${pending}`)
      .send({ code });
    expect(dead.status).toBe(401);
  });

  it('silently drops a resend inside the 60s cooldown (always 200)', async () => {
    const customer = await createCustomer();
    await enableTwoFactorFor(customer);
    await expireTwoFactorCooldown();

    const { pending } = await loginToPending(customer);
    // Exactly one code went out with the login.
    expect(sentEmails()).toHaveLength(1);

    const resent = await api()
      .post('/api/v1/auth/2fa/resend')
      .set('Cookie', `twoFactorPending=${pending}`);
    expect(resent.status).toBe(200);
    // …and the cooldown swallowed the resend: still just the one email.
    expect(sentEmails()).toHaveLength(1);
  });

  it('resends a FRESH code once the cooldown has passed (old code dies)', async () => {
    const customer = await createCustomer();
    await enableTwoFactorFor(customer);
    await expireTwoFactorCooldown();

    const { code: firstCode, pending } = await loginToPending(customer);
    await expireTwoFactorCooldown();

    const resent = await api()
      .post('/api/v1/auth/2fa/resend')
      .set('Cookie', `twoFactorPending=${pending}`);
    expect(resent.status).toBe(200);
    expect(sentEmails()).toHaveLength(2);
    const freshCode = otpFromEmail(customer.email ?? '');

    // Issuing replaces: the first code is dead, the fresh one logs in.
    if (freshCode !== firstCode) {
      const stale = await api()
        .post('/api/v1/auth/2fa/verify')
        .set('Cookie', `twoFactorPending=${pending}`)
        .send({ code: firstCode });
      expect(stale.status).toBe(401);
    }
    const verified = await api()
      .post('/api/v1/auth/2fa/verify')
      .set('Cookie', `twoFactorPending=${pending}`)
      .send({ code: freshCode });
    expect(verified.status).toBe(200);
  });
});

describe('2FA bypasses (documented): OTP login and Google sign-in', () => {
  it('OTP login signs a 2FA-enabled customer straight in (single possession factor)', async () => {
    const customer = await createCustomer();
    await enableTwoFactorFor(customer);
    await expireTwoFactorCooldown();
    clearMessages();

    await api()
      .post('/api/v1/auth/otp/request')
      .send({ email: customer.email });
    const code = otpFromEmail(customer.email ?? '');

    const verified = await api()
      .post('/api/v1/auth/otp/verify')
      .send({ code, email: customer.email });

    // A full session, immediately — no twoFactorRequired step.
    expect(verified.status).toBe(200);
    expect(verified.body.data.id).toBe(customer.id);
    expect(cookieValue(verified, 'accessToken')).toBeTruthy();
    expect(cookieValue(verified, 'refreshToken')).toBeTruthy();
    expect(cookieValue(verified, 'twoFactorPending')).toBeUndefined();
  });

  it('Google sign-in resolves a 2FA-enabled customer without a challenge', async () => {
    const customer = await createCustomer({ email: 'g-2fa@test.local' });
    await prisma.customer.update({
      data: { googleId: 'google-2fa-sub', twoFactorEnabled: true },
      where: { id: customer.id },
    });

    const google: GoogleAuthClient = {
      verifyIdToken: vi.fn(() =>
        Promise.resolve({
          email: 'g-2fa@test.local',
          emailVerified: true,
          googleId: 'google-2fa-sub',
          name: customer.name,
        }),
      ),
    };
    const service = makeAuthService({
      clock: systemClock,
      config: {
        ACCESS_TOKEN_EXPIRY: ENV.ACCESS_TOKEN_EXPIRY,
        ACCESS_TOKEN_SECRET: ENV.ACCESS_TOKEN_SECRET,
        FRONTEND_URL: ENV.FRONTEND_URL,
        GOOGLE_CLIENT_ID: 'test-google-client-id',
        REFRESH_TOKEN_EXPIRY: ENV.REFRESH_TOKEN_EXPIRY,
        REFRESH_TOKEN_SECRET: ENV.REFRESH_TOKEN_SECRET,
      },
      google,
      logger,
      notify: { email: vi.fn(), sms: vi.fn() },
      prisma,
    });

    // The account resolves directly — the controller mints a session from
    // this return with no second factor in between.
    const resolved = await service.googleSignIn('a-valid-token');
    expect(resolved.id).toBe(customer.id);

    // And no TWO_FACTOR challenge was issued anywhere in the flow.
    const challenges = await prisma.userSecurityToken.count({
      where: { customerId: customer.id, type: TokenType.TWO_FACTOR },
    });
    expect(challenges).toBe(0);
  });
});
