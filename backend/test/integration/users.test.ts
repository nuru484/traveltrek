// test/integration/users.test.ts
//
// Baseline behaviour of user management before the refactor: role gates on
// listing, admin user creation with roles, role changes, self-updates.
import { describe, expect, it } from 'vitest';

import { authedApi } from '../helpers/auth';
import { createAdmin, createUser } from '../helpers/factories';

describe('GET /api/v1/users', () => {
  it('lets an admin list users', async () => {
    const admin = await createAdmin();
    await createUser();
    await createUser();

    const res = await authedApi(admin).get('/api/v1/users');

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(3);
  });

  it('forbids customers from listing users', async () => {
    const customer = await createUser();
    const res = await authedApi(customer).get('/api/v1/users');
    expect(res.status).toBe(403);
  });
});

describe('POST /api/v1/users', () => {
  it('lets an admin create a user with an explicit role', async () => {
    const admin = await createAdmin();

    const res = await authedApi(admin).post('/api/v1/users').send({
      address: '99 Admin Way',
      email: 'agent@test.local',
      name: 'Agent Smith',
      password: 'Password1!',
      role: 'AGENT',
    });

    expect(res.status).toBe(201);
    expect(res.body.data.role).toBe('AGENT');
  });

  it('forbids customers from creating users', async () => {
    const customer = await createUser();
    const res = await authedApi(customer).post('/api/v1/users').send({
      address: '1 Nope Street',
      email: 'nope@test.local',
      name: 'Nope',
      password: 'Password1!',
    });
    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/v1/users/:userId/role', () => {
  it('lets an admin change a user role', async () => {
    const admin = await createAdmin();
    const user = await createUser();

    const res = await authedApi(admin)
      .patch(`/api/v1/users/${user.id}/role`)
      .send({ role: 'AGENT' });

    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe('AGENT');
  });

  it('forbids non-admins from changing roles', async () => {
    const customer = await createUser();
    const other = await createUser();
    const res = await authedApi(customer)
      .patch(`/api/v1/users/${other.id}/role`)
      .send({ role: 'ADMIN' });
    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/users/:userId', () => {
  it('returns a user for an admin without the password field', async () => {
    const admin = await createAdmin();
    const user = await createUser();

    const res = await authedApi(admin).get(`/api/v1/users/${user.id}`);

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(user.email);
    expect(res.body.data.password).toBeUndefined();
  });
});

describe('PUT /api/v1/users/:userId', () => {
  it('lets a user update their own profile', async () => {
    const user = await createUser();

    const res = await authedApi(user)
      .put(`/api/v1/users/${user.id}`)
      .send({ name: 'Renamed Self' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Renamed Self');
  });
});
