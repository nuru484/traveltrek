// test/integration/users-extra.test.ts
//
// Coverage the baseline users suite lacks, updated for Phase 5b (STAFF-only
// users): the staff-vs-customer route gates, uniqueness conflicts, the
// password field being stripped from profile updates (rotation is POST
// /auth/change-password only), role-change guard rails (including the
// legacy-reserved CUSTOMER value) and their effect, and the delete
// protections (admin self-delete, the bulk confirmation gate). Staff carry no bookings/payments anymore, so the
// legacy payment-based delete guards are gone — deletes are plain soft
// deletes. JSON-only flows — no multipart, so the Cloudinary upload path
// stays out of scope here.
import bcrypt from 'bcrypt';
import { describe, expect, it } from 'vitest';

import prisma, { Role } from '#config/prismaClient.js';

import { authedApi } from '../helpers/auth.js';
import {
  createAdmin,
  createAgent,
  createCustomer,
  TEST_PASSWORD,
} from '../helpers/factories.js';

describe('PUT /api/v1/users/:userId (gates and rules)', () => {
  it('rejects a customer updating a staff profile with 403 (route gate)', async () => {
    const customer = await createCustomer();
    const victim = await createAgent();

    const res = await authedApi(customer)
      .put(`/api/v1/users/${victim.id}`)
      .send({ name: 'Hijacked' });

    expect(res.status).toBe(403);

    const untouched = await prisma.user.findUnique({
      where: { id: victim.id },
    });
    expect(untouched?.name).toBe(victim.name);
  });

  it("lets an agent update another staff user's profile", async () => {
    const agent = await createAgent();
    const other = await createAgent();

    const res = await authedApi(agent)
      .put(`/api/v1/users/${other.id}`)
      .send({ name: 'Renamed By Agent' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Renamed By Agent');
    expect(res.body.data.password).toBeUndefined();
  });

  it('rejects an update to an email already taken by another user with 409', async () => {
    const user = await createAgent();
    const other = await createAgent();

    const res = await authedApi(user)
      .put(`/api/v1/users/${user.id}`)
      .send({ email: other.email });

    expect(res.status).toBe(409);
    expect(res.body.message).toBe('A user with this email already exists.');
  });

  it('rejects an update to a phone already taken by another user with 409', async () => {
    const user = await createAgent();
    const other = await createAgent();

    const res = await authedApi(user)
      .put(`/api/v1/users/${user.id}`)
      .send({ phone: other.phone });

    expect(res.status).toBe(409);
    expect(res.body.message).toBe(
      'A user with this phone number already exists.',
    );
  });

  it('IGNORES a password in the body — updates never touch credentials', async () => {
    const user = await createAgent();

    // The schema strips the removed key, so the update still succeeds — but
    // the stored hash is untouched: passwords rotate ONLY through the
    // authenticated POST /auth/change-password.
    const res = await authedApi(user)
      .put(`/api/v1/users/${user.id}`)
      .send({ name: 'Renamed', password: 'NewPassword9!' });

    expect(res.status).toBe(200);
    expect(res.body.data.password).toBeUndefined();

    const row = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(row.password).toBe(user.password);
    expect(await bcrypt.compare('NewPassword9!', row.password!)).toBe(false);
    expect(await bcrypt.compare(TEST_PASSWORD, row.password!)).toBe(true);
  });

  it('returns 404 for an admin updating a missing user', async () => {
    const admin = await createAdmin();

    const res = await authedApi(admin)
      .put('/api/v1/users/999999')
      .send({ name: 'Ghost' });

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('User not found.');
  });
});

describe('GET /api/v1/users/:userId (gates)', () => {
  it('rejects a customer viewing a staff profile with 403 (route gate)', async () => {
    const customer = await createCustomer();
    const agent = await createAgent();

    const res = await authedApi(customer).get(`/api/v1/users/${agent.id}`);

    expect(res.status).toBe(403);
  });

  it('lets a staff user view their own profile, without the password', async () => {
    const agent = await createAgent();

    const res = await authedApi(agent).get(`/api/v1/users/${agent.id}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(agent.id);
    expect(res.body.data.email).toBe(agent.email);
    expect(res.body.data.password).toBeUndefined();
  });
});

describe('PATCH /api/v1/users/:userId/role (guards and effects)', () => {
  it('forbids an admin changing their own role', async () => {
    const admin = await createAdmin();

    const res = await authedApi(admin)
      .patch(`/api/v1/users/${admin.id}/role`)
      .send({ role: 'AGENT' });

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('You cannot change your own role');
  });

  it('rejects a no-op role change with 400', async () => {
    const admin = await createAdmin();
    const agent = await createAgent();

    const res = await authedApi(admin)
      .patch(`/api/v1/users/${agent.id}/role`)
      .send({ role: 'AGENT' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('User already has the role: AGENT');
  });

  it('rejects an invalid role value with 400', async () => {
    const admin = await createAdmin();
    const agent = await createAgent();

    const res = await authedApi(admin)
      .patch(`/api/v1/users/${agent.id}/role`)
      .send({ role: 'SUPERUSER' });

    expect(res.status).toBe(400);
  });

  it('rejects the legacy-reserved CUSTOMER role with 400', async () => {
    const admin = await createAdmin();
    const agent = await createAgent();

    const res = await authedApi(admin)
      .patch(`/api/v1/users/${agent.id}/role`)
      .send({ role: 'CUSTOMER' });

    expect(res.status).toBe(400);
  });

  it('grants admin powers after a promotion (fresh token)', async () => {
    const admin = await createAdmin();
    const agent = await createAgent();
    const target = await createAgent();

    // Agents may not delete users (ADMIN-only route).
    const before = await authedApi(agent).delete(
      `/api/v1/users/${target.id}`,
    );
    expect(before.status).toBe(403);

    const promote = await authedApi(admin)
      .patch(`/api/v1/users/${agent.id}/role`)
      .send({ role: 'ADMIN' });
    expect(promote.status).toBe(200);
    expect(promote.body.data.role).toBe('ADMIN');

    // A token minted after the change (i.e. re-login) carries the new role.
    const after = await authedApi({ id: agent.id, role: Role.ADMIN }).delete(
      `/api/v1/users/${target.id}`,
    );
    expect(after.status).toBe(200);
  });
});

describe('DELETE /api/v1/users/:userId (guards)', () => {
  it('forbids an admin deleting themselves', async () => {
    const admin = await createAdmin();

    const res = await authedApi(admin).delete(`/api/v1/users/${admin.id}`);

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Admins cannot delete themselves');
  });

  it('soft-deletes a staff user (no payment guard — staff own no payments)', async () => {
    const admin = await createAdmin();
    const agent = await createAgent();

    const res = await authedApi(admin).delete(`/api/v1/users/${agent.id}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe(
      `User "${agent.name}" (${agent.email}) deleted successfully`,
    );

    // Soft delete: hidden from scoped reads, but the row survives with a
    // deletedAt tombstone (findUnique is deliberately unscoped).
    const gone = await prisma.user.findFirst({ where: { id: agent.id } });
    expect(gone).toBeNull();
    const tombstone = await prisma.user.findUnique({
      where: { id: agent.id },
    });
    expect(tombstone?.deletedAt).toBeInstanceOf(Date);
  });

  it('returns 404 for a missing user', async () => {
    const admin = await createAdmin();

    const res = await authedApi(admin).delete('/api/v1/users/999999');

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('User not found');
  });
});

describe('DELETE /api/v1/users (bulk guards)', () => {
  it('requires the confirmation phrase', async () => {
    const admin = await createAdmin();
    await createAgent();

    const res = await authedApi(admin).delete('/api/v1/users').send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('requires confirmation');
  });

  it('deletes every staff user except the acting admin when confirmed', async () => {
    const admin = await createAdmin();
    await createAgent();
    await createAgent();

    const res = await authedApi(admin)
      .delete('/api/v1/users')
      .send({ confirmDelete: 'DELETE_ALL_USERS' });

    expect(res.status).toBe(200);
    expect(res.body.data.deletedCount).toBe(2);

    const remaining = await prisma.user.findMany();
    expect(remaining.map((u) => u.id)).toEqual([admin.id]);
  });
});
