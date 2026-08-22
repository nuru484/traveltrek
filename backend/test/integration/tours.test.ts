// test/integration/tours.test.ts
//
// Behaviour of the tour CRUD surface: role gates, validation, pagination and
// filters, plus the soft-delete semantics of the deletedAt column.
import { describe, expect, it } from 'vitest';

import prisma from '#config/prismaClient.js';

import { authedApi } from '../helpers/auth.js';
import {
  createAdmin,
  createDestination,
  createTour,
  createUser,
} from '../helpers/factories.js';

const tourPayload = (destinationId: number) => ({
  description: 'Seven days across the Volta highlands',
  destinationId,
  duration: 7,
  endDate: '2027-03-08',
  maxGuests: 12,
  name: 'Volta Highlands Trek',
  price: 950,
  startDate: '2027-03-01',
  type: 'ADVENTURE',
});

describe('POST /api/v1/tours', () => {
  it('lets an admin create a tour', async () => {
    const admin = await createAdmin();
    const destination = await createDestination();

    const res = await authedApi(admin)
      .post('/api/v1/tours')
      .send(tourPayload(destination.id));

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Volta Highlands Trek');
  });

  it('forbids customers from creating tours', async () => {
    const customer = await createUser();
    const destination = await createDestination();

    const res = await authedApi(customer)
      .post('/api/v1/tours')
      .send(tourPayload(destination.id));

    expect(res.status).toBe(403);
  });

  it('rejects an invalid payload with field errors', async () => {
    const admin = await createAdmin();
    const res = await authedApi(admin).post('/api/v1/tours').send({
      name: 'X',
    });
    expect(res.status).toBe(400);
    expect(res.body.status).toBe('error');
  });
});

describe('GET /api/v1/tours', () => {
  it('returns a paginated list with meta', async () => {
    const customer = await createUser();
    const destination = await createDestination();
    for (let i = 0; i < 3; i++) {
      await createTour({ destinationId: destination.id });
    }

    const res = await authedApi(customer).get('/api/v1/tours?page=1&limit=2');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta).toMatchObject({
      limit: 2,
      page: 1,
      total: 3,
      totalPages: 2,
    });
  });

  it('filters by search term', async () => {
    const customer = await createUser();
    await createTour({ name: 'Savannah Safari Special' });
    await createTour({ name: 'Coastal Cruise' });

    const res = await authedApi(customer).get('/api/v1/tours?search=Savannah');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Savannah Safari Special');
  });
});

describe('GET /api/v1/tours/:id', () => {
  it('returns a tour by id', async () => {
    const customer = await createUser();
    const tour = await createTour();

    const res = await authedApi(customer).get(`/api/v1/tours/${tour.id}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(tour.id);
  });

  it('404s for a missing tour', async () => {
    const customer = await createUser();
    const res = await authedApi(customer).get('/api/v1/tours/999999');
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/v1/tours/:id', () => {
  it('lets an admin update a tour', async () => {
    const admin = await createAdmin();
    const tour = await createTour();

    const res = await authedApi(admin)
      .put(`/api/v1/tours/${tour.id}`)
      .send({ price: 1234 });

    expect(res.status).toBe(200);
    expect(res.body.data.price).toBe(1234);
  });

  it('forbids customers from updating tours', async () => {
    const customer = await createUser();
    const tour = await createTour();
    const res = await authedApi(customer)
      .put(`/api/v1/tours/${tour.id}`)
      .send({ price: 1 });
    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/v1/tours/:id', () => {
  it('lets an admin delete a tour without bookings', async () => {
    const admin = await createAdmin();
    const tour = await createTour();

    const res = await authedApi(admin).delete(`/api/v1/tours/${tour.id}`);

    expect(res.status).toBe(200);
    const gone = await authedApi(admin).get(`/api/v1/tours/${tour.id}`);
    expect(gone.status).toBe(404);
  });

  it('forbids customers from deleting tours', async () => {
    const customer = await createUser();
    const tour = await createTour();
    const res = await authedApi(customer).delete(`/api/v1/tours/${tour.id}`);
    expect(res.status).toBe(403);
  });
});

describe('tour soft deletes', () => {
  it('hides a deleted tour from list and get, but keeps the row', async () => {
    const admin = await createAdmin();
    const destination = await createDestination();
    const tour = await createTour({
      destinationId: destination.id,
      name: 'Tombstone Trek',
    });

    const del = await authedApi(admin).delete(`/api/v1/tours/${tour.id}`);
    expect(del.status).toBe(200);

    // Vanishes from the list...
    const list = await authedApi(admin).get('/api/v1/tours?search=Tombstone');
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(0);

    // ...and the direct get 404s...
    const gone = await authedApi(admin).get(`/api/v1/tours/${tour.id}`);
    expect(gone.status).toBe(404);

    // ...but the row survives in the DB with a deletedAt tombstone (explicit
    // deletedAt predicate opts out of the extension's scoping).
    const tombstone = await prisma.tour.findFirst({
      where: { deletedAt: { not: null }, id: tour.id },
    });
    expect(tombstone).not.toBeNull();
    expect(tombstone?.deletedAt).toBeInstanceOf(Date);
  });

  it('allows re-creating a tour with the same name after deletion', async () => {
    const admin = await createAdmin();
    const destination = await createDestination();
    const tour = await createTour({
      destinationId: destination.id,
      name: 'Recreated Ridge Walk',
    });

    const del = await authedApi(admin).delete(`/api/v1/tours/${tour.id}`);
    expect(del.status).toBe(200);

    const res = await authedApi(admin).post('/api/v1/tours').send({
      description: 'Same name, brand new tour',
      destinationId: destination.id,
      endDate: '2027-03-08',
      maxGuests: 12,
      name: 'Recreated Ridge Walk',
      price: 95000,
      startDate: '2027-03-01',
      type: 'ADVENTURE',
    });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Recreated Ridge Walk');
    expect(res.body.data.id).not.toBe(tour.id);
  });
});
