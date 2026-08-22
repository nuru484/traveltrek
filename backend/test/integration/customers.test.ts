// test/integration/customers.test.ts
//
// The customers domain: staff-side CRUD over the customer base,
// the full-profile read (identity + lifetime activity counters), the COMPLETE
// paginated booking/payment history endpoints, and the self-access rule —
// a customer may reach exactly their own profile/history, staff reach anyone.
import { describe, expect, it } from 'vitest';

import prisma, { BookingStatus } from '#config/prismaClient.js';

import { api, authedApi } from '../helpers/auth.js';
import {
  createAdmin,
  createAgent,
  createCustomer,
  createTour,
  TEST_PASSWORD,
} from '../helpers/factories.js';

/** A tour booking (+ optional payment) for history/guard scenarios. */
const createBookingFor = async (
  customerId: number,
  overrides: { status?: BookingStatus; withPayment?: boolean } = {},
) => {
  const tour = await createTour();
  const booking = await prisma.booking.create({
    data: {
      customerId,
      status: overrides.status ?? BookingStatus.PENDING,
      totalPrice: 500,
      tourId: tour.id,
    },
  });
  if (overrides.withPayment) {
    await prisma.payment.create({
      data: {
        amount: 500,
        bookingId: booking.id,
        customerId,
        paymentMethod: 'CREDIT_CARD',
        status: 'COMPLETED',
        transactionReference: `customers-ref-${String(booking.id)}`,
      },
    });
  }
  return booking;
};

describe('GET /api/v1/customers', () => {
  it('lets staff list customers with pagination meta', async () => {
    const agent = await createAgent();
    await createCustomer();
    await createCustomer();

    const res = await authedApi(agent).get('/api/v1/customers');

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
    expect(res.body.meta).toMatchObject({ limit: 10, page: 1, total: 2 });
    expect(res.body.data[0].password).toBeUndefined();
  });

  it('searches across name, email and phone', async () => {
    const admin = await createAdmin();
    const needle = await createCustomer({ name: 'Findable Fatima' });
    await createCustomer({ name: 'Someone Else' });

    const res = await authedApi(admin).get(
      '/api/v1/customers?search=findable',
    );

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].id).toBe(needle.id);
  });

  it('forbids customers from listing the customer base', async () => {
    const customer = await createCustomer();
    const res = await authedApi(customer).get('/api/v1/customers');
    expect(res.status).toBe(403);
  });
});

describe('POST /api/v1/customers', () => {
  it('lets staff create a minimal customer (name + phone, no password)', async () => {
    const agent = await createAgent();

    const res = await authedApi(agent).post('/api/v1/customers').send({
      name: 'Walk-in Wanda',
      phone: '233551234567',
    });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Walk-in Wanda');
    expect(res.body.data.phone).toBe('233551234567');

    const row = await prisma.customer.findUniqueOrThrow({
      where: { phone: '233551234567' },
    });
    expect(row.password).toBeNull();
  });

  it('IGNORES a provided password — staff never set customer credentials', async () => {
    const admin = await createAdmin();

    // The schema strips unknown/removed keys, so the request still succeeds —
    // but the account is created passwordless (OTP login / forgot-password /
    // change-password establish a password later).
    const res = await authedApi(admin).post('/api/v1/customers').send({
      email: 'created@test.local',
      name: 'Created Customer',
      password: 'Created9!',
    });
    expect(res.status).toBe(201);

    const row = await prisma.customer.findUniqueOrThrow({
      where: { email: 'created@test.local' },
    });
    expect(row.password).toBeNull();

    // And the stripped password is not a credential.
    const login = await api()
      .post('/api/v1/auth/login')
      .send({ email: 'created@test.local', password: 'Created9!' });
    expect(login.status).toBe(401);
  });

  it('rejects a creation with neither email nor phone', async () => {
    const admin = await createAdmin();
    const res = await authedApi(admin)
      .post('/api/v1/customers')
      .send({ name: 'No Contact' });
    expect(res.status).toBe(400);
  });

  it('rejects a duplicate email with 409', async () => {
    const admin = await createAdmin();
    const existing = await createCustomer();

    const res = await authedApi(admin)
      .post('/api/v1/customers')
      .send({ email: existing.email, name: 'Duplicate' });

    expect(res.status).toBe(409);
    expect(res.body.message).toBe(
      'A customer with this email already exists.',
    );
  });

  it('forbids customers from creating customers', async () => {
    const customer = await createCustomer();
    const res = await authedApi(customer)
      .post('/api/v1/customers')
      .send({ email: 'x@test.local', name: 'X' });
    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/customers/:id (full profile + self-access)', () => {
  it('returns the full profile with activity counters for staff', async () => {
    const agent = await createAgent();
    const customer = await createCustomer();
    await createBookingFor(customer.id, { withPayment: true });
    await createBookingFor(customer.id);

    const res = await authedApi(agent).get(`/api/v1/customers/${customer.id}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(customer.id);
    expect(res.body.data.email).toBe(customer.email);
    expect(res.body.data.password).toBeUndefined();
    // The exhaustive per-field assertions live in customer-profile.test.ts;
    // this pins the headline counters plus the derived money stats.
    expect(res.body.data.stats).toMatchObject({
      averageBookingValue: 500,
      bookingsByStatus: { PENDING: 2 },
      totalBookings: 2,
      totalPayments: 1,
      totalSpent: 500,
      upcomingTrips: 2,
    });
  });

  it('lets a customer fetch THEIR OWN profile', async () => {
    const customer = await createCustomer();

    const res = await authedApi(customer).get(
      `/api/v1/customers/${customer.id}`,
    );

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(customer.id);
  });

  it("blocks a customer from another customer's profile", async () => {
    const customer = await createCustomer();
    const other = await createCustomer();

    const res = await authedApi(customer).get(`/api/v1/customers/${other.id}`);

    expect(res.status).toBe(401);
    expect(res.body.message).toBe(
      'You are not authorized to view this customer profile',
    );
  });

  it('a STAFF principal with the same numeric id is not "self" (kind matters)', async () => {
    // Ids overlap across the two tables; an agent whose staff id equals a
    // customer id must still pass as STAFF (allowed), never as that customer.
    const customer = await createCustomer();
    const agent = await createAgent();

    // Staff access works regardless of id equality…
    const res = await authedApi(agent).get(`/api/v1/customers/${customer.id}`);
    expect(res.status).toBe(200);

    // …while a CUSTOMER token with the agent's id only reaches that id's
    // customer row, not anything staff-ish.
    const forged = await authedApi({ id: customer.id, kind: 'customer' }).get(
      '/api/v1/customers',
    );
    expect(forged.status).toBe(403);
  });

  it('404s for a missing customer', async () => {
    const admin = await createAdmin();
    const res = await authedApi(admin).get('/api/v1/customers/999999');
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Customer not found');
  });
});

describe('GET /api/v1/customers/:id/bookings and /payments (full history)', () => {
  it('returns the COMPLETE paginated booking history for staff', async () => {
    const admin = await createAdmin();
    const customer = await createCustomer();
    for (let i = 0; i < 3; i++) await createBookingFor(customer.id);

    const page1 = await authedApi(admin).get(
      `/api/v1/customers/${customer.id}/bookings?limit=2&page=1`,
    );
    expect(page1.status).toBe(200);
    expect(page1.body.data.length).toBe(2);
    expect(page1.body.meta).toMatchObject({
      limit: 2,
      page: 1,
      total: 3,
      totalPages: 2,
    });
    expect(page1.body.data[0].customerId).toBe(customer.id);
    expect(page1.body.data[0].customer.email).toBe(customer.email);

    const page2 = await authedApi(admin).get(
      `/api/v1/customers/${customer.id}/bookings?limit=2&page=2`,
    );
    expect(page2.body.data.length).toBe(1);
  });

  it('returns the payment history with the bookedItem block', async () => {
    const agent = await createAgent();
    const customer = await createCustomer();
    await createBookingFor(customer.id, { withPayment: true });

    const res = await authedApi(agent).get(
      `/api/v1/customers/${customer.id}/payments`,
    );

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].customerId).toBe(customer.id);
    expect(res.body.data[0].bookedItem.type).toBe('TOUR');
    expect(res.body.meta.total).toBe(1);
  });

  it('lets a customer read their own history but not anyone else’s', async () => {
    const customer = await createCustomer();
    const other = await createCustomer();
    await createBookingFor(customer.id, { withPayment: true });

    const own = await authedApi(customer).get(
      `/api/v1/customers/${customer.id}/bookings`,
    );
    expect(own.status).toBe(200);
    expect(own.body.data.length).toBe(1);

    const bookings = await authedApi(customer).get(
      `/api/v1/customers/${other.id}/bookings`,
    );
    expect(bookings.status).toBe(401);
    expect(bookings.body.message).toBe('You can only view your own bookings');

    const payments = await authedApi(customer).get(
      `/api/v1/customers/${other.id}/payments`,
    );
    expect(payments.status).toBe(401);
    expect(payments.body.message).toBe('You can only view your own payments');
  });

  it('404s the history of a missing customer', async () => {
    const admin = await createAdmin();
    const res = await authedApi(admin).get(
      '/api/v1/customers/999999/payments',
    );
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/v1/customers/:id', () => {
  it('lets a customer update their own profile', async () => {
    const customer = await createCustomer();

    const res = await authedApi(customer)
      .put(`/api/v1/customers/${customer.id}`)
      .send({ name: 'Renamed Self' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Renamed Self');
  });

  it("blocks a customer from updating another customer's profile", async () => {
    const customer = await createCustomer();
    const victim = await createCustomer();

    const res = await authedApi(customer)
      .put(`/api/v1/customers/${victim.id}`)
      .send({ name: 'Hijacked' });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe(
      'You are not authorized to update this customer.',
    );
  });

  it('rejects an email already taken by another customer with 409', async () => {
    const agent = await createAgent();
    const customer = await createCustomer();
    const other = await createCustomer();

    const res = await authedApi(agent)
      .put(`/api/v1/customers/${customer.id}`)
      .send({ email: other.email });

    expect(res.status).toBe(409);
    expect(res.body.message).toBe(
      'A customer with this email already exists.',
    );
  });

  it('IGNORES a password in the body — updates never touch credentials', async () => {
    const customer = await createCustomer();

    // The schema strips the removed key, so the update succeeds — but the
    // stored hash is untouched (rotation is POST /auth/change-password only).
    const res = await authedApi(customer)
      .put(`/api/v1/customers/${customer.id}`)
      .send({ name: 'Renamed', password: 'Rotated9!' });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Renamed');

    const row = await prisma.customer.findUniqueOrThrow({
      where: { id: customer.id },
    });
    expect(row.password).toBe(customer.password);

    // The "new" password never became a credential; the old one still works.
    const rejected = await api()
      .post('/api/v1/auth/login')
      .send({ email: customer.email, password: 'Rotated9!' });
    expect(rejected.status).toBe(401);
    const stillValid = await api()
      .post('/api/v1/auth/login')
      .send({ email: customer.email, password: TEST_PASSWORD });
    expect(stillValid.status).toBe(200);
  });
});

describe('DELETE /api/v1/customers/:id', () => {
  it('is ADMIN-only (agents are refused)', async () => {
    const agent = await createAgent();
    const customer = await createCustomer();

    const res = await authedApi(agent).delete(
      `/api/v1/customers/${customer.id}`,
    );
    expect(res.status).toBe(403);
  });

  it('refuses to delete a customer with an active booking (409)', async () => {
    const admin = await createAdmin();
    const customer = await createCustomer();
    await createBookingFor(customer.id, { status: BookingStatus.CONFIRMED });

    const res = await authedApi(admin).delete(
      `/api/v1/customers/${customer.id}`,
    );

    expect(res.status).toBe(409);
    expect(res.body.message).toContain('active (pending or confirmed)');

    const stillThere = await prisma.customer.findUnique({
      where: { id: customer.id },
    });
    expect(stillThere?.deletedAt).toBeNull();
  });

  it('soft-deletes a customer whose bookings are all settled', async () => {
    const admin = await createAdmin();
    const customer = await createCustomer();
    await createBookingFor(customer.id, { status: BookingStatus.COMPLETED });

    const res = await authedApi(admin).delete(
      `/api/v1/customers/${customer.id}`,
    );

    expect(res.status).toBe(200);
    expect(res.body.message).toBe(
      `Customer "${customer.name}" (${customer.email}) deleted successfully`,
    );

    // Soft delete: hidden from scoped reads, but the row survives with a
    // deletedAt tombstone (findUnique is deliberately unscoped).
    const gone = await prisma.customer.findFirst({
      where: { id: customer.id },
    });
    expect(gone).toBeNull();
    const tombstone = await prisma.customer.findUnique({
      where: { id: customer.id },
    });
    expect(tombstone?.deletedAt).toBeInstanceOf(Date);
  });

  it('404s for a missing customer', async () => {
    const admin = await createAdmin();
    const res = await authedApi(admin).delete('/api/v1/customers/999999');
    expect(res.status).toBe(404);
  });
});
