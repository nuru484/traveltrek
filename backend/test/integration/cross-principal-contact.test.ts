// test/integration/cross-principal-contact.test.ts
//
// Login and password reset resolve an email customer-first, then staff —
// which is only safe when a contact can never live in both tables at once.
// These tests pin the cross-table uniqueness guard on every path that writes
// an email or phone to either principal table.
import { describe, expect, it } from 'vitest';

import { api, authedApi } from '../helpers/auth.js';
import {
  createAdmin,
  createCustomer,
  createUser,
  TEST_PASSWORD,
} from '../helpers/factories.js';

describe('cross-principal contact uniqueness', () => {
  it('public signup cannot claim a staff email', async () => {
    const staff = await createUser({ email: 'agent-jo@test.local' });

    const res = await api().post('/api/v1/auth/register-user').send({
      email: staff.email,
      name: 'Shadow Account',
    });

    expect(res.status).toBe(409);
    expect(res.body.message).toBe('An account with this email already exists.');

    // The staff account still logs in with their password.
    const login = await api()
      .post('/api/v1/auth/login')
      .send({ email: staff.email, password: TEST_PASSWORD });
    expect(login.status).toBe(200);
  });

  it('public signup cannot claim a staff phone', async () => {
    const staff = await createUser({ phone: '233550117788' });

    const res = await api().post('/api/v1/auth/register-user').send({
      name: 'Shadow Phone',
      phone: staff.phone,
    });

    expect(res.status).toBe(409);
    expect(res.body.message).toBe(
      'An account with this phone number already exists.',
    );
  });

  it('admin staff creation cannot claim a customer email', async () => {
    const admin = await createAdmin();
    const customer = await createCustomer({ email: 'cust-amina@test.local' });

    const res = await authedApi(admin).post('/api/v1/users').send({
      address: '1 Office Way',
      email: customer.email,
      name: 'New Agent',
      role: 'AGENT',
    });

    expect(res.status).toBe(409);
    expect(res.body.message).toBe('An account with this email already exists.');
  });

  it('staff-side customer creation cannot claim a staff email', async () => {
    const admin = await createAdmin();
    const staff = await createUser({ email: 'agent-kofi@test.local' });

    const res = await authedApi(admin).post('/api/v1/customers').send({
      email: staff.email,
      name: 'Walk-in',
    });

    expect(res.status).toBe(409);
  });

  it('customer profile update cannot move onto a staff contact', async () => {
    const staff = await createUser({ email: 'agent-ama@test.local' });
    const customer = await createCustomer();

    const res = await authedApi(customer)
      .put(`/api/v1/customers/${customer.id}`)
      .send({ email: staff.email });

    expect(res.status).toBe(409);
  });

  it('staff profile update cannot move onto a customer contact', async () => {
    const admin = await createAdmin();
    const customer = await createCustomer({ phone: '233550116655' });

    const res = await authedApi(admin)
      .put(`/api/v1/users/${admin.id}`)
      .send({ phone: customer.phone });

    expect(res.status).toBe(409);
  });
});
