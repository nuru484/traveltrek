// test/integration/bookings.test.ts
//
// Baseline behaviour of the booking flows before the service-layer refactor:
// self-booking rules, capacity guards, duplicate protection, role-scoped reads.
import { describe, expect, it } from 'vitest';

import prisma from '#config/prismaClient.js';

import { authedApi } from '../helpers/auth.js';
import {
  createAdmin,
  createTour,
  createUser,
} from '../helpers/factories.js';

describe('POST /api/v1/bookings', () => {
  it('lets a customer book a tour for themselves', async () => {
    const customer = await createUser();
    const tour = await createTour({ maxGuests: 10, price: 500 });

    const res = await authedApi(customer).post('/api/v1/bookings').send({
      numberOfGuests: 2,
      totalPrice: 1000,
      tourId: tour.id,
      userId: customer.id,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('PENDING');
    expect(res.body.data.numberOfGuests).toBe(2);
  });

  it('updates the tour guest counter', async () => {
    const customer = await createUser();
    const tour = await createTour({ maxGuests: 10 });

    await authedApi(customer).post('/api/v1/bookings').send({
      numberOfGuests: 3,
      totalPrice: 1500,
      tourId: tour.id,
      userId: customer.id,
    });

    const updated = await prisma.tour.findUnique({ where: { id: tour.id } });
    expect(updated?.guestsBooked).toBe(3);
  });

  it('stops a customer from booking for someone else', async () => {
    const customer = await createUser();
    const other = await createUser();
    const tour = await createTour();

    const res = await authedApi(customer).post('/api/v1/bookings').send({
      numberOfGuests: 1,
      totalPrice: 500,
      tourId: tour.id,
      userId: other.id,
    });

    expect(res.status).toBe(401);
  });

  it('lets an admin book on behalf of a customer', async () => {
    const admin = await createAdmin();
    const customer = await createUser();
    const tour = await createTour();

    const res = await authedApi(admin).post('/api/v1/bookings').send({
      numberOfGuests: 1,
      totalPrice: 500,
      tourId: tour.id,
      userId: customer.id,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.userId).toBe(customer.id);
  });

  it('rejects a booking beyond remaining capacity', async () => {
    const customer = await createUser();
    const tour = await createTour({ maxGuests: 2 });

    const res = await authedApi(customer).post('/api/v1/bookings').send({
      numberOfGuests: 3,
      totalPrice: 1500,
      tourId: tour.id,
      userId: customer.id,
    });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it('rejects a duplicate booking for the same tour', async () => {
    const customer = await createUser();
    const tour = await createTour();

    const first = await authedApi(customer).post('/api/v1/bookings').send({
      numberOfGuests: 1,
      totalPrice: 500,
      tourId: tour.id,
      userId: customer.id,
    });
    expect(first.status).toBe(201);

    const second = await authedApi(customer).post('/api/v1/bookings').send({
      numberOfGuests: 1,
      totalPrice: 500,
      tourId: tour.id,
      userId: customer.id,
    });
    expect(second.status).toBeGreaterThanOrEqual(400);
    expect(second.status).toBeLessThan(500);
  });

  it('rejects a booking with no bookable item', async () => {
    const customer = await createUser();
    const res = await authedApi(customer).post('/api/v1/bookings').send({
      numberOfGuests: 1,
      totalPrice: 100,
      userId: customer.id,
    });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/v1/bookings', () => {
  it('scopes the list for customers to their own bookings', async () => {
    const customerA = await createUser();
    const customerB = await createUser();
    const tour = await createTour();
    const tourB = await createTour();

    await authedApi(customerA).post('/api/v1/bookings').send({
      numberOfGuests: 1,
      totalPrice: 500,
      tourId: tour.id,
      userId: customerA.id,
    });
    await authedApi(customerB).post('/api/v1/bookings').send({
      numberOfGuests: 1,
      totalPrice: 500,
      tourId: tourB.id,
      userId: customerB.id,
    });

    const res = await authedApi(customerA).get('/api/v1/bookings');

    expect(res.status).toBe(200);
    const userIds = new Set(
      (res.body.data as { userId: number }[]).map((b) => b.userId),
    );
    expect(userIds).toEqual(new Set([customerA.id]));
  });

  it('lets an admin see all bookings', async () => {
    const admin = await createAdmin();
    const customerA = await createUser();
    const customerB = await createUser();
    const tourA = await createTour();
    const tourB = await createTour();

    await authedApi(customerA).post('/api/v1/bookings').send({
      numberOfGuests: 1,
      totalPrice: 500,
      tourId: tourA.id,
      userId: customerA.id,
    });
    await authedApi(customerB).post('/api/v1/bookings').send({
      numberOfGuests: 1,
      totalPrice: 500,
      tourId: tourB.id,
      userId: customerB.id,
    });

    const res = await authedApi(admin).get('/api/v1/bookings');

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
  });
});

describe('GET /api/v1/bookings/:id', () => {
  it('blocks a customer from reading another customer’s booking', async () => {
    const customerA = await createUser();
    const customerB = await createUser();
    const tour = await createTour();

    const created = await authedApi(customerA).post('/api/v1/bookings').send({
      numberOfGuests: 1,
      totalPrice: 500,
      tourId: tour.id,
      userId: customerA.id,
    });

    const res = await authedApi(customerB).get(
      `/api/v1/bookings/${created.body.data.id}`,
    );
    expect([401, 403, 404]).toContain(res.status);
  });
});

describe('DELETE /api/v1/bookings/:id', () => {
  it('lets an admin delete a booking', async () => {
    const admin = await createAdmin();
    const customer = await createUser();
    const tour = await createTour();

    const created = await authedApi(customer).post('/api/v1/bookings').send({
      numberOfGuests: 1,
      totalPrice: 500,
      tourId: tour.id,
      userId: customer.id,
    });

    const res = await authedApi(admin).delete(
      `/api/v1/bookings/${created.body.data.id}`,
    );
    expect(res.status).toBe(200);
  });

  it('forbids customers from deleting bookings', async () => {
    const customer = await createUser();
    const tour = await createTour();

    const created = await authedApi(customer).post('/api/v1/bookings').send({
      numberOfGuests: 1,
      totalPrice: 500,
      tourId: tour.id,
      userId: customer.id,
    });

    const res = await authedApi(customer).delete(
      `/api/v1/bookings/${created.body.data.id}`,
    );
    expect(res.status).toBe(403);
  });
});
