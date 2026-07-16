// test/integration/users.test.ts
//
// Baseline behaviour of STAFF management (Phase 5b: the User table is
// staff-only — customers live in /customers): role gates on listing, admin
// staff creation with a required staff role, role changes, self-updates.
import { describe, expect, it, vi } from 'vitest';

import { cloudinaryService } from '#config/claudinary.js';
import prisma from '#config/prismaClient.js';

import { authedApi } from '../helpers/auth.js';
import {
  createAdmin,
  createAgent,
  createCustomer,
} from '../helpers/factories.js';

// The mocked service method is a vi.fn() (test/setup.ts fakes Cloudinary), so
// the unbound reference is safe — there is no `this` to lose.
// eslint-disable-next-line @typescript-eslint/unbound-method
const deleteImageMock = vi.mocked(cloudinaryService.deleteImage);

describe('GET /api/v1/users', () => {
  it('lets an admin list staff users', async () => {
    const admin = await createAdmin();
    await createAgent();
    await createAgent();

    const res = await authedApi(admin).get('/api/v1/users');

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(3);
  });

  it('forbids customers from listing users', async () => {
    const customer = await createCustomer();
    const res = await authedApi(customer).get('/api/v1/users');
    expect(res.status).toBe(403);
  });
});

describe('POST /api/v1/users', () => {
  it('lets an admin create a staff user with an explicit role — always passwordless', async () => {
    const admin = await createAdmin();

    // A password in the body is STRIPPED by the schema: admins never set
    // passwords, the new staffer establishes one via forgot-password.
    const res = await authedApi(admin).post('/api/v1/users').send({
      address: '99 Admin Way',
      email: 'agent@test.local',
      name: 'Agent Smith',
      password: 'Password1!',
      role: 'AGENT',
    });

    expect(res.status).toBe(201);
    expect(res.body.data.role).toBe('AGENT');

    const row = await prisma.user.findUniqueOrThrow({
      where: { email: 'agent@test.local' },
    });
    expect(row.password).toBeNull();
  });

  it('rejects the legacy-reserved CUSTOMER role with 400', async () => {
    const admin = await createAdmin();

    const res = await authedApi(admin).post('/api/v1/users').send({
      address: '1 Customer Lane',
      email: 'not-staff@test.local',
      name: 'Not Staff',
      password: 'Password1!',
      role: 'CUSTOMER',
    });

    expect(res.status).toBe(400);
  });

  it('requires a role (staff creation is explicit)', async () => {
    const admin = await createAdmin();

    const res = await authedApi(admin).post('/api/v1/users').send({
      address: '2 No Role Road',
      email: 'no-role@test.local',
      name: 'No Role',
      password: 'Password1!',
    });

    expect(res.status).toBe(400);
  });

  it('forbids customers from creating users', async () => {
    const customer = await createCustomer();
    const res = await authedApi(customer).post('/api/v1/users').send({
      address: '1 Nope Street',
      email: 'nope@test.local',
      name: 'Nope',
      password: 'Password1!',
      role: 'AGENT',
    });
    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/v1/users/:userId/role', () => {
  it('lets an admin change a staff role', async () => {
    const admin = await createAdmin();
    const agent = await createAgent();

    const res = await authedApi(admin)
      .patch(`/api/v1/users/${agent.id}/role`)
      .send({ role: 'ADMIN' });

    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe('ADMIN');
  });

  it('forbids non-admins from changing roles', async () => {
    const customer = await createCustomer();
    const agent = await createAgent();
    const res = await authedApi(customer)
      .patch(`/api/v1/users/${agent.id}/role`)
      .send({ role: 'ADMIN' });
    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/users/:userId', () => {
  it('returns a staff user for an admin without the password field', async () => {
    const admin = await createAdmin();
    const agent = await createAgent();

    const res = await authedApi(admin).get(`/api/v1/users/${agent.id}`);

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(agent.email);
    expect(res.body.data.password).toBeUndefined();
  });
});

describe('PUT /api/v1/users/:userId', () => {
  it('lets a staff user update their own profile', async () => {
    const agent = await createAgent();

    const res = await authedApi(agent)
      .put(`/api/v1/users/${agent.id}`)
      .send({ name: 'Renamed Self' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Renamed Self');
  });

  it('removes the profile picture with profilePicture: "" and reclaims the image', async () => {
    const agent = await createAgent();

    // Give the profile a picture through the real multipart pipeline first.
    const withPicture = await authedApi(agent)
      .put(`/api/v1/users/${agent.id}`)
      .attach('profilePicture', Buffer.from('89504e470d0a1a0a', 'hex'), {
        contentType: 'image/png',
        filename: 'me.png',
      });
    expect(withPicture.status).toBe(200);
    const oldPicture: string = withPicture.body.data.profilePicture;
    expect(oldPicture).toMatch(/^https:\/\/res\.cloudinary\.com\/test\//);

    deleteImageMock.mockClear();

    const removed = await authedApi(agent)
      .put(`/api/v1/users/${agent.id}`)
      .send({ profilePicture: '' });

    expect(removed.status).toBe(200);
    // The user DTO omits null fields, so the key disappears from the wire...
    expect(removed.body.data.profilePicture).toBeUndefined();
    // ...and the column itself is nulled.
    const row = await prisma.user.findUnique({ where: { id: agent.id } });
    expect(row?.profilePicture).toBeNull();
    // The removed image is reclaimed via the injected cloudinary dep.
    expect(deleteImageMock).toHaveBeenCalledWith(oldPicture);
  });

  it('leaves the profile picture untouched when the update omits it', async () => {
    const agent = await createAgent();

    const withPicture = await authedApi(agent)
      .put(`/api/v1/users/${agent.id}`)
      .attach('profilePicture', Buffer.from('89504e470d0a1a0a', 'hex'), {
        contentType: 'image/png',
        filename: 'me.png',
      });
    expect(withPicture.status).toBe(200);

    deleteImageMock.mockClear();

    const renamed = await authedApi(agent)
      .put(`/api/v1/users/${agent.id}`)
      .send({ name: 'Renamed, picture kept' });

    expect(renamed.status).toBe(200);
    expect(renamed.body.data.profilePicture).toBe(
      withPicture.body.data.profilePicture,
    );
    expect(deleteImageMock).not.toHaveBeenCalled();
  });
});
