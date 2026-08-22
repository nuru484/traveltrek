// test/integration/hotels.test.ts
//
// Behaviour of the hotel CRUD surface: role gates, validation, pagination,
// filters and the delete-with-rooms guard.
import { describe, expect, it } from 'vitest';

import { authedApi } from '../helpers/auth.js';
import {
  createAdmin,
  createDestination,
  createHotel,
  createRoom,
  createUser,
} from '../helpers/factories.js';

const hotelPayload = (destinationId: number) => ({
  address: '12 Beachside Avenue, Accra',
  amenities: ['wifi', 'pool'],
  description: 'A breezy seaside test hotel',
  destinationId,
  name: 'Seaside Retreat',
  phone: '233550001000',
  starRating: 4,
});

describe('POST /api/v1/hotels', () => {
  it('lets an admin create a hotel', async () => {
    const admin = await createAdmin();
    const destination = await createDestination();

    const res = await authedApi(admin)
      .post('/api/v1/hotels')
      .send(hotelPayload(destination.id));

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Hotel created successfully');
    expect(res.body.data).toMatchObject({
      amenities: ['wifi', 'pool'],
      destination: { id: destination.id },
      name: 'Seaside Retreat',
      rooms: [],
      starRating: 4,
    });
  });

  it('forbids customers from creating hotels', async () => {
    const customer = await createUser();
    const destination = await createDestination();

    const res = await authedApi(customer)
      .post('/api/v1/hotels')
      .send(hotelPayload(destination.id));

    expect(res.status).toBe(403);
  });

  it('rejects an invalid payload with field errors', async () => {
    const admin = await createAdmin();
    const res = await authedApi(admin).post('/api/v1/hotels').send({
      name: 'X',
      starRating: 9,
    });
    expect(res.status).toBe(400);
    expect(res.body.status).toBe('error');
  });
});

describe('GET /api/v1/hotels', () => {
  it('returns a paginated list with meta', async () => {
    const customer = await createUser();
    const destination = await createDestination();
    for (let i = 0; i < 3; i++) {
      await createHotel({ destinationId: destination.id });
    }

    const res = await authedApi(customer).get('/api/v1/hotels?page=1&limit=2');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta).toMatchObject({
      limit: 2,
      page: 1,
      total: 3,
      totalPages: 2,
    });
  });

  it('filters by destination', async () => {
    const customer = await createUser();
    const destination = await createDestination();
    await createHotel({ destinationId: destination.id });
    await createHotel({ destinationId: destination.id });
    await createHotel(); // a hotel elsewhere

    const res = await authedApi(customer).get(
      `/api/v1/hotels?destinationId=${destination.id}`,
    );

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });
});

describe('GET /api/v1/hotels/:id', () => {
  it('returns a hotel by id', async () => {
    const customer = await createUser();
    const hotel = await createHotel();

    const res = await authedApi(customer).get(`/api/v1/hotels/${hotel.id}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(hotel.id);
  });

  it('404s for a missing hotel', async () => {
    const customer = await createUser();
    const res = await authedApi(customer).get('/api/v1/hotels/999999');
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/v1/hotels/:id', () => {
  it('lets an admin update a hotel', async () => {
    const admin = await createAdmin();
    const hotel = await createHotel();

    const res = await authedApi(admin)
      .put(`/api/v1/hotels/${hotel.id}`)
      .send({ amenities: ['spa'], starRating: 5 });

    expect(res.status).toBe(200);
    expect(res.body.data.starRating).toBe(5);
    expect(res.body.data.amenities).toEqual(['spa']);
  });

  it('forbids customers from updating hotels', async () => {
    const customer = await createUser();
    const hotel = await createHotel();
    const res = await authedApi(customer)
      .put(`/api/v1/hotels/${hotel.id}`)
      .send({ starRating: 1 });
    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/v1/hotels/:id', () => {
  it('refuses to delete a hotel that still has rooms', async () => {
    const admin = await createAdmin();
    const hotel = await createHotel();
    await createRoom({ hotelId: hotel.id });

    const res = await authedApi(admin).delete(`/api/v1/hotels/${hotel.id}`);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe(
      'Cannot delete hotel with existing rooms. Please remove rooms first.',
    );
  });

  it('lets an admin delete a hotel without rooms', async () => {
    const admin = await createAdmin();
    const hotel = await createHotel();

    const res = await authedApi(admin).delete(`/api/v1/hotels/${hotel.id}`);

    expect(res.status).toBe(200);
    const gone = await authedApi(admin).get(`/api/v1/hotels/${hotel.id}`);
    expect(gone.status).toBe(404);
  });
});
