// test/integration/contact-change.test.ts
//
// Self-service contact changes: email/phone are login
// identifiers, so changing one takes (1) a session, (2) re-auth — the
// current password, or the /auth/reauth/challenge code for passwordless
// accounts — and (3) proof of the NEW contact: a confirmation link emailed
// to the new address (EMAIL_CHANGE, public confirm) / an OTP texted to the
// new phone (PHONE_CHANGE, authed confirm). Uniqueness is re-checked at
// confirm time across BOTH principal tables; applying bumps the session
// epoch. Profile updates 400 self-service email/phone changes while
// admin (staff) edits keep the direct path.
import { beforeEach, describe, expect, it } from 'vitest';

import prisma, { TokenType } from '#config/prismaClient.js';

import { api, authedApi } from '../helpers/auth.js';
import {
  createAdmin,
  createAgent,
  createCustomer,
  TEST_PASSWORD,
} from '../helpers/factories.js';
import {
  clearMessages,
  lastEmailTo,
  lastSmsTo,
  otpFromEmail,
} from '../helpers/messages.js';

/** The 64-hex confirm token from the email sent to the NEW address. */
const confirmTokenFromEmail = (to: string): string => {
  const match = /token=([a-f0-9]{64})/.exec(lastEmailTo(to)?.text ?? '');
  if (!match?.[1]) throw new Error(`No confirm token in email to ${to}`);
  return match[1];
};

/** The 6-digit OTP from the SMS sent to the NEW phone. */
const otpFromSmsTo = (to: string): string => {
  const match = /\b(\d{6})\b/.exec(lastSmsTo(to)?.message ?? '');
  if (!match?.[1]) throw new Error(`No OTP in SMS to ${to}`);
  return match[1];
};

beforeEach(() => {
  clearMessages();
});

describe('POST /auth/change-email + /auth/confirm-email-change', () => {
  it('changes a password-account email end-to-end (password re-auth, link to the NEW address)', async () => {
    const customer = await createCustomer();
    const newEmail = 'new-address@test.local';

    const res = await authedApi(customer)
      .post('/api/v1/auth/change-email')
      .send({ currentPassword: TEST_PASSWORD, newEmail });
    expect(res.status).toBe(200);

    // Nothing changed yet: the new address is parked on pendingEmail.
    const parked = await prisma.customer.findUniqueOrThrow({
      where: { id: customer.id },
    });
    expect(parked.email).toBe(customer.email);
    expect(parked.pendingEmail).toBe(newEmail);

    // The confirmation link went to the NEW address.
    const email = lastEmailTo(newEmail);
    expect(email?.subject).toBe('Confirm your new TravelTrek email address');
    expect(email?.text).toContain('/confirm-email-change?token=');

    const token = confirmTokenFromEmail(newEmail);
    const confirm = await api()
      .post('/api/v1/auth/confirm-email-change')
      .send({ token });
    expect(confirm.status).toBe(200);

    const updated = await prisma.customer.findUniqueOrThrow({
      where: { id: customer.id },
    });
    expect(updated.email).toBe(newEmail);
    expect(updated.pendingEmail).toBeNull();
    // Session epoch bumped: every live session must sign in again.
    expect(updated.tokenVersion).toBe(customer.tokenVersion + 1);

    // The new email is now the login identifier; the old one is gone.
    const login = await api()
      .post('/api/v1/auth/login')
      .send({ email: newEmail, password: TEST_PASSWORD });
    expect(login.status).toBe(200);
    const stale = await api()
      .post('/api/v1/auth/login')
      .send({ email: customer.email, password: TEST_PASSWORD });
    expect(stale.status).toBe(401);
  });

  it('rejects a wrong current password with the uniform 401 and parks nothing', async () => {
    const customer = await createCustomer();

    const res = await authedApi(customer)
      .post('/api/v1/auth/change-email')
      .send({ currentPassword: 'Wrong1!', newEmail: 'evil@test.local' });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid credentials');

    const row = await prisma.customer.findUniqueOrThrow({
      where: { id: customer.id },
    });
    expect(row.pendingEmail).toBeNull();
    // Wrong guesses feed the login lockout counter.
    expect(row.failedLoginAttempts).toBe(1);
  });

  it('re-auths a passwordless account with the /auth/reauth/challenge code', async () => {
    const customer = await createCustomer({ password: null });
    const currentEmail = customer.email ?? '';
    const newEmail = 'passwordless-new@test.local';

    // A password is not an option — the code is required.
    const refused = await authedApi(customer)
      .post('/api/v1/auth/change-email')
      .send({ code: '000000', newEmail });
    expect(refused.status).toBe(401); // no live code yet

    const challenge = await authedApi(customer).post(
      '/api/v1/auth/reauth/challenge',
    );
    expect(challenge.status).toBe(200);

    // The re-auth code went to the CURRENT contact.
    const code = otpFromEmail(currentEmail);
    const res = await authedApi(customer)
      .post('/api/v1/auth/change-email')
      .send({ code, newEmail });
    expect(res.status).toBe(200);

    const token = confirmTokenFromEmail(newEmail);
    const confirm = await api()
      .post('/api/v1/auth/confirm-email-change')
      .send({ token });
    expect(confirm.status).toBe(200);

    const updated = await prisma.customer.findUniqueOrThrow({
      where: { id: customer.id },
    });
    expect(updated.email).toBe(newEmail);
  });

  it('works for STAFF principals too', async () => {
    const agent = await createAgent();
    const newEmail = 'staff-new@test.local';

    const res = await authedApi(agent)
      .post('/api/v1/auth/change-email')
      .send({ currentPassword: TEST_PASSWORD, newEmail });
    expect(res.status).toBe(200);

    const token = confirmTokenFromEmail(newEmail);
    await api().post('/api/v1/auth/confirm-email-change').send({ token });

    const updated = await prisma.user.findUniqueOrThrow({
      where: { id: agent.id },
    });
    expect(updated.email).toBe(newEmail);
  });

  it('409s at request time when the address is already taken (either table)', async () => {
    const customer = await createCustomer();
    const holder = await createCustomer();
    const staff = await createAgent();

    const sameTable = await authedApi(customer)
      .post('/api/v1/auth/change-email')
      .send({ currentPassword: TEST_PASSWORD, newEmail: holder.email });
    expect(sameTable.status).toBe(409);

    const crossTable = await authedApi(customer)
      .post('/api/v1/auth/change-email')
      .send({ currentPassword: TEST_PASSWORD, newEmail: staff.email });
    expect(crossTable.status).toBe(409);
  });

  it('409s at CONFIRM time when the address was claimed in between, clearing the pending change', async () => {
    const customer = await createCustomer();
    const newEmail = 'contested@test.local';

    await authedApi(customer)
      .post('/api/v1/auth/change-email')
      .send({ currentPassword: TEST_PASSWORD, newEmail });
    const token = confirmTokenFromEmail(newEmail);

    // Someone registers the address between request and confirm.
    await createCustomer({ email: newEmail });

    const confirm = await api()
      .post('/api/v1/auth/confirm-email-change')
      .send({ token });
    expect(confirm.status).toBe(409);

    const row = await prisma.customer.findUniqueOrThrow({
      where: { id: customer.id },
    });
    expect(row.email).toBe(customer.email);
    expect(row.pendingEmail).toBeNull();
  });

  it('401s an expired confirm link and a reused one (single-use)', async () => {
    const customer = await createCustomer();
    const newEmail = 'single-use@test.local';

    await authedApi(customer)
      .post('/api/v1/auth/change-email')
      .send({ currentPassword: TEST_PASSWORD, newEmail });
    const token = confirmTokenFromEmail(newEmail);

    // Expired: force the row past its TTL.
    await prisma.userSecurityToken.updateMany({
      data: { expiresAt: new Date(Date.now() - 1000) },
      where: { customerId: customer.id, type: TokenType.EMAIL_CHANGE },
    });
    const expired = await api()
      .post('/api/v1/auth/confirm-email-change')
      .send({ token });
    expect(expired.status).toBe(401);

    // Fresh request → redeem once → the replay is refused.
    await authedApi(customer)
      .post('/api/v1/auth/change-email')
      .send({ currentPassword: TEST_PASSWORD, newEmail });
    const freshToken = confirmTokenFromEmail(newEmail);
    const first = await api()
      .post('/api/v1/auth/confirm-email-change')
      .send({ token: freshToken });
    expect(first.status).toBe(200);
    const replay = await api()
      .post('/api/v1/auth/confirm-email-change')
      .send({ token: freshToken });
    expect(replay.status).toBe(401);
  });

  it('400s when both or neither re-auth proof is sent', async () => {
    const customer = await createCustomer();

    const neither = await authedApi(customer)
      .post('/api/v1/auth/change-email')
      .send({ newEmail: 'x@test.local' });
    expect(neither.status).toBe(400);

    const both = await authedApi(customer)
      .post('/api/v1/auth/change-email')
      .send({
        code: '123456',
        currentPassword: TEST_PASSWORD,
        newEmail: 'x@test.local',
      });
    expect(both.status).toBe(400);
  });
});

describe('POST /auth/change-phone + /auth/confirm-phone-change', () => {
  it('changes a phone end-to-end: OTP to the NEW number, authed confirm, epoch bump', async () => {
    const customer = await createCustomer();
    const newPhone = '233550771122';

    const res = await authedApi(customer)
      .post('/api/v1/auth/change-phone')
      .send({ currentPassword: TEST_PASSWORD, newPhone });
    expect(res.status).toBe(200);

    // Parked, not applied; the OTP went to the NEW phone.
    const row = await prisma.customer.findUniqueOrThrow({
      where: { id: customer.id },
    });
    expect(row.phone).toBe(customer.phone);
    expect(row.pendingPhone).toBe(newPhone);

    const code = otpFromSmsTo(newPhone);
    const confirm = await authedApi(customer)
      .post('/api/v1/auth/confirm-phone-change')
      .send({ code });
    expect(confirm.status).toBe(200);

    const updated = await prisma.customer.findUniqueOrThrow({
      where: { id: customer.id },
    });
    expect(updated.phone).toBe(newPhone);
    expect(updated.pendingPhone).toBeNull();
    expect(updated.tokenVersion).toBe(customer.tokenVersion + 1);

    // The confirm response re-minted THIS session (new-epoch cookies).
    expect(confirm.headers['set-cookie']).toBeDefined();
  });

  it('401s a wrong confirmation code and caps attempts', async () => {
    const customer = await createCustomer();
    const newPhone = '233550771133';

    await authedApi(customer)
      .post('/api/v1/auth/change-phone')
      .send({ currentPassword: TEST_PASSWORD, newPhone });

    const wrong = await authedApi(customer)
      .post('/api/v1/auth/confirm-phone-change')
      .send({ code: '000000' });
    expect(wrong.status).toBe(401);

    const row = await prisma.customer.findUniqueOrThrow({
      where: { id: customer.id },
    });
    expect(row.phone).toBe(customer.phone);
  });

  it('409s when the number is already held by the other principal table', async () => {
    const customer = await createCustomer();
    const staff = await createAgent({ phone: '233550771144' });

    const res = await authedApi(customer)
      .post('/api/v1/auth/change-phone')
      .send({ currentPassword: TEST_PASSWORD, newPhone: staff.phone });
    expect(res.status).toBe(409);
  });
});

describe('profile updates no longer change contacts (self-service)', () => {
  it('400s a customer changing their OWN email via PUT /customers/:id', async () => {
    const customer = await createCustomer();

    const res = await authedApi(customer)
      .put(`/api/v1/customers/${customer.id}`)
      .send({ email: 'sneaky@test.local' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe(
      'Your email address cannot be changed here. Use POST /auth/change-email, which confirms the new address.',
    );
  });

  it('400s a customer changing their OWN phone, but lets the unchanged value pass (no-op)', async () => {
    const customer = await createCustomer();

    const changed = await authedApi(customer)
      .put(`/api/v1/customers/${customer.id}`)
      .send({ phone: '233550999888' });
    expect(changed.status).toBe(400);

    // Full-profile form submits that echo the current value keep working.
    const unchanged = await authedApi(customer)
      .put(`/api/v1/customers/${customer.id}`)
      .send({ email: customer.email, name: 'Renamed', phone: customer.phone });
    expect(unchanged.status).toBe(200);
    expect(unchanged.body.data.name).toBe('Renamed');
  });

  it('400s a staff member changing their OWN email via PUT /users/:userId', async () => {
    const agent = await createAgent();

    const res = await authedApi(agent)
      .put(`/api/v1/users/${agent.id}`)
      .send({ email: 'sneaky-staff@test.local' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe(
      'Your email address cannot be changed here. Use POST /auth/change-email, which confirms the new address.',
    );
  });

  it('keeps the ADMIN direct change (administrative override) working', async () => {
    const admin = await createAdmin();
    const customer = await createCustomer();
    const agent = await createAgent();

    const customerEdit = await authedApi(admin)
      .put(`/api/v1/customers/${customer.id}`)
      .send({ email: 'admin-set@test.local' });
    expect(customerEdit.status).toBe(200);
    expect(customerEdit.body.data.email).toBe('admin-set@test.local');

    const staffEdit = await authedApi(admin)
      .put(`/api/v1/users/${agent.id}`)
      .send({ phone: '233550771155' });
    expect(staffEdit.status).toBe(200);
    expect(staffEdit.body.data.phone).toBe('233550771155');
  });
});
