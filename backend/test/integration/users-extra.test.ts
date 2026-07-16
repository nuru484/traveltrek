// test/integration/users-extra.test.ts
//
// Coverage the baseline users suite lacks, pinned against the service-layer
// refactor: the self-vs-others actor rules on profile viewing and updates,
// uniqueness conflicts, password re-hashing, role-change guard rails and
// their effect, and the delete protections (active payments, admin
// self-delete, the bulk confirmation gate). JSON-only flows — no multipart,
// so the Cloudinary upload path stays out of scope here.
import bcrypt from 'bcrypt';
import { describe, expect, it } from 'vitest';

import prisma, {
  PaymentStatus,
  Role,
} from '#config/prismaClient.js';

import { authedApi } from '../helpers/auth.js';
import {
  createAdmin,
  createAgent,
  createTour,
  createUser,
  TEST_PASSWORD,
} from '../helpers/factories.js';

/** A booking + payment pair for the delete-guard tests. */
const createPaymentFor = async (userId: number, status: PaymentStatus) => {
  const tour = await createTour();
  const booking = await prisma.booking.create({
    data: { totalPrice: 500, tourId: tour.id, userId },
  });
  return prisma.payment.create({
    data: {
      amount: 500,
      bookingId: booking.id,
      paymentMethod: 'CREDIT_CARD',
      status,
      transactionReference: `users-extra-ref-${String(booking.id)}`,
      userId,
    },
  });
};

describe('PUT /api/v1/users/:userId (actor rules)', () => {
  it("rejects a customer updating another user's profile with 401", async () => {
    const customer = await createUser();
    const victim = await createUser();

    const res = await authedApi(customer)
      .put(`/api/v1/users/${victim.id}`)
      .send({ name: 'Hijacked' });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe(
      'You are not authorized to update this user.',
    );

    const untouched = await prisma.user.findUnique({
      where: { id: victim.id },
    });
    expect(untouched?.name).toBe(victim.name);
  });

  it("lets an agent update another user's profile", async () => {
    const agent = await createAgent();
    const customer = await createUser();

    const res = await authedApi(agent)
      .put(`/api/v1/users/${customer.id}`)
      .send({ name: 'Renamed By Agent' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Renamed By Agent');
    expect(res.body.data.password).toBeUndefined();
  });

  it('rejects an update to an email already taken by another user with 409', async () => {
    const user = await createUser();
    const other = await createUser();

    const res = await authedApi(user)
      .put(`/api/v1/users/${user.id}`)
      .send({ email: other.email });

    expect(res.status).toBe(409);
    expect(res.body.message).toBe('A user with this email already exists.');
  });

  it('rejects an update to a phone already taken by another user with 409', async () => {
    const user = await createUser();
    const other = await createUser();

    const res = await authedApi(user)
      .put(`/api/v1/users/${user.id}`)
      .send({ phone: other.phone });

    expect(res.status).toBe(409);
    expect(res.body.message).toBe(
      'A user with this phone number already exists.',
    );
  });

  it('re-hashes a changed password with bcrypt at the configured cost', async () => {
    const user = await createUser();

    const res = await authedApi(user)
      .put(`/api/v1/users/${user.id}`)
      .send({ password: 'NewPassword9!' });

    expect(res.status).toBe(200);
    expect(res.body.data.password).toBeUndefined();

    const row = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(row.password).not.toBe('NewPassword9!');
    expect(await bcrypt.compare('NewPassword9!', row.password)).toBe(true);
    expect(await bcrypt.compare(TEST_PASSWORD, row.password)).toBe(false);
    // BCRYPT_SALT_ROUNDS from config/constants.
    expect(bcrypt.getRounds(row.password)).toBe(10);
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

describe('GET /api/v1/users/:userId (actor rules)', () => {
  it("rejects a customer viewing another user's profile with 401", async () => {
    const customer = await createUser();
    const other = await createUser();

    const res = await authedApi(customer).get(`/api/v1/users/${other.id}`);

    expect(res.status).toBe(401);
    expect(res.body.message).toBe(
      'You are not authorized to view this user profile',
    );
  });

  it('lets a customer view their own profile, without the password', async () => {
    const customer = await createUser();

    const res = await authedApi(customer).get(`/api/v1/users/${customer.id}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(customer.id);
    expect(res.body.data.email).toBe(customer.email);
    expect(res.body.data.password).toBeUndefined();
  });
});

describe('PATCH /api/v1/users/:userId/role (guards and effects)', () => {
  it('forbids an admin changing their own role', async () => {
    const admin = await createAdmin();

    const res = await authedApi(admin)
      .patch(`/api/v1/users/${admin.id}/role`)
      .send({ role: 'CUSTOMER' });

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('You cannot change your own role');
  });

  it('rejects a no-op role change with 400', async () => {
    const admin = await createAdmin();
    const customer = await createUser();

    const res = await authedApi(admin)
      .patch(`/api/v1/users/${customer.id}/role`)
      .send({ role: 'CUSTOMER' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('User already has the role: CUSTOMER');
  });

  it('rejects an invalid role value with 400', async () => {
    const admin = await createAdmin();
    const customer = await createUser();

    const res = await authedApi(admin)
      .patch(`/api/v1/users/${customer.id}/role`)
      .send({ role: 'SUPERUSER' });

    expect(res.status).toBe(400);
  });

  it('grants agent access after a promotion (fresh token)', async () => {
    const admin = await createAdmin();
    const customer = await createUser();

    // Customers may not list users.
    const before = await authedApi(customer).get('/api/v1/users');
    expect(before.status).toBe(403);

    const promote = await authedApi(admin)
      .patch(`/api/v1/users/${customer.id}/role`)
      .send({ role: 'AGENT' });
    expect(promote.status).toBe(200);
    expect(promote.body.data.role).toBe('AGENT');

    // A token minted after the change (i.e. re-login) carries the new role.
    const after = await authedApi({ id: customer.id, role: Role.AGENT }).get(
      '/api/v1/users',
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

  it('refuses to delete a user with a non-refunded payment (409)', async () => {
    const admin = await createAdmin();
    const customer = await createUser();
    await createPaymentFor(customer.id, PaymentStatus.COMPLETED);

    const res = await authedApi(admin).delete(`/api/v1/users/${customer.id}`);

    expect(res.status).toBe(409);
    expect(res.body.message).toContain('active (non-refunded) payments');

    const stillThere = await prisma.user.findUnique({
      where: { id: customer.id },
    });
    expect(stillThere).not.toBeNull();
  });

  it('deletes a user whose only payment is refunded', async () => {
    const admin = await createAdmin();
    const customer = await createUser();
    await createPaymentFor(customer.id, PaymentStatus.REFUNDED);

    const res = await authedApi(admin).delete(`/api/v1/users/${customer.id}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe(
      `User "${customer.name}" (${customer.email}) deleted successfully`,
    );

    const gone = await prisma.user.findUnique({ where: { id: customer.id } });
    expect(gone).toBeNull();
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
    await createUser();

    const res = await authedApi(admin).delete('/api/v1/users').send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('requires confirmation');
  });

  it('is refused entirely while any user has a non-refunded payment', async () => {
    const admin = await createAdmin();
    const blocked = await createUser();
    await createUser();
    await createPaymentFor(blocked.id, PaymentStatus.PENDING);

    const res = await authedApi(admin)
      .delete('/api/v1/users')
      .send({ confirmDelete: 'DELETE_ALL_USERS' });

    expect(res.status).toBe(409);
    expect(res.body.message).toContain('active (non-refunded) payments');
    expect(await prisma.user.count()).toBe(3);
  });

  it('deletes every user except the acting admin when confirmed', async () => {
    const admin = await createAdmin();
    await createUser();
    await createUser();

    const res = await authedApi(admin)
      .delete('/api/v1/users')
      .send({ confirmDelete: 'DELETE_ALL_USERS' });

    expect(res.status).toBe(200);
    expect(res.body.data.deletedCount).toBe(2);

    const remaining = await prisma.user.findMany();
    expect(remaining.map((u) => u.id)).toEqual([admin.id]);
  });
});
