// test/integration/flights.test.ts
//
// Behaviour of the flight CRUD surface after the service-layer refactor: role
// gates, validation, pagination, filters, the status state machine and the
// booking-aware delete guards.
import { describe, expect, it } from 'vitest';

import prisma, { BookingStatus } from '../../src/config/prismaClient';
import { authedApi } from '../helpers/auth';
import {
  createAdmin,
  createDestination,
  createFlight,
  createUser,
} from '../helpers/factories';

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

const inDays = (days: number) => new Date(Date.now() + days * DAY_MS);

const flightPayload = (originId: number, destinationId: number) => {
  const departure = inDays(14);
  return {
    airline: 'Test Airways',
    arrival: new Date(departure.getTime() + 6 * HOUR_MS).toISOString(),
    capacity: 180,
    departure: departure.toISOString(),
    destinationId,
    flightClass: 'Economy',
    flightNumber: 'TA123',
    originId,
    price: 450,
    stops: 1,
  };
};

/** A PENDING flight booking placed directly in the DB. */
const createPendingBooking = async (flightId: number, userId: number) =>
  prisma.booking.create({
    data: {
      flightId,
      status: BookingStatus.PENDING,
      totalPrice: 800,
      userId,
    },
  });

describe('POST /api/v1/flights', () => {
  it('lets an admin create a flight', async () => {
    const admin = await createAdmin();
    const origin = await createDestination();
    const destination = await createDestination();

    const res = await authedApi(admin)
      .post('/api/v1/flights')
      .send(flightPayload(origin.id, destination.id));

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Flight created successfully');
    expect(res.body.data).toMatchObject({
      airline: 'Test Airways',
      capacity: 180,
      destination: { id: destination.id, name: destination.name },
      duration: 360,
      flightClass: 'Economy',
      flightNumber: 'TA123',
      origin: { id: origin.id, name: origin.name },
      price: 450,
      seatsAvailable: 180,
      status: 'SCHEDULED',
      stops: 1,
    });
  });

  it('forbids customers from creating flights', async () => {
    const customer = await createUser();
    const origin = await createDestination();
    const destination = await createDestination();

    const res = await authedApi(customer)
      .post('/api/v1/flights')
      .send(flightPayload(origin.id, destination.id));

    expect(res.status).toBe(403);
  });

  it('rejects an invalid payload with field errors', async () => {
    const admin = await createAdmin();
    const res = await authedApi(admin).post('/api/v1/flights').send({
      airline: 'A',
      flightNumber: 'not a flight number',
    });
    expect(res.status).toBe(400);
    expect(res.body.status).toBe('error');
  });
});

describe('GET /api/v1/flights', () => {
  it('returns a paginated list with meta and echoed filters', async () => {
    const customer = await createUser();
    for (let i = 0; i < 3; i++) {
      await createFlight();
    }

    const res = await authedApi(customer).get('/api/v1/flights?page=1&limit=2');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta).toMatchObject({
      filters: { sortBy: 'departure', sortOrder: 'asc' },
      limit: 2,
      page: 1,
      total: 3,
      totalPages: 2,
    });
  });

  it('filters by origin', async () => {
    const customer = await createUser();
    const origin = await createDestination();
    await createFlight({ originId: origin.id });
    await createFlight({ originId: origin.id });
    await createFlight(); // a flight from elsewhere

    const res = await authedApi(customer).get(
      `/api/v1/flights?originId=${origin.id}`,
    );

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta.filters.originId).toBe(origin.id);
  });
});

describe('GET /api/v1/flights/:id', () => {
  it('returns a flight by id with its route summaries', async () => {
    const customer = await createUser();
    const flight = await createFlight();

    const res = await authedApi(customer).get(`/api/v1/flights/${flight.id}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(flight.id);
    expect(res.body.data.capacity).toBe(100);
    expect(res.body.data.origin).toMatchObject({ id: flight.originId });
    expect(res.body.data.destination).toMatchObject({
      id: flight.destinationId,
    });
  });

  it('404s for a missing flight', async () => {
    const customer = await createUser();
    const res = await authedApi(customer).get('/api/v1/flights/999999');
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/v1/flights/:id', () => {
  it('lets an admin update a flight', async () => {
    const admin = await createAdmin();
    const flight = await createFlight();

    const res = await authedApi(admin)
      .put(`/api/v1/flights/${flight.id}`)
      .send({ airline: 'Renamed Air', price: 999 });

    expect(res.status).toBe(200);
    expect(res.body.data.airline).toBe('Renamed Air');
    expect(res.body.data.price).toBe(999);
  });

  it('forbids customers from updating flights', async () => {
    const customer = await createUser();
    const flight = await createFlight();
    const res = await authedApi(customer)
      .put(`/api/v1/flights/${flight.id}`)
      .send({ price: 1 });
    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/v1/flights/:id/status', () => {
  it('delays a scheduled flight when both new times are sent', async () => {
    const admin = await createAdmin();
    // Factory flights depart in 14 days; the delayed departure must be later.
    const flight = await createFlight();
    const newDeparture = inDays(15);
    const newArrival = new Date(newDeparture.getTime() + 6 * HOUR_MS);

    const res = await authedApi(admin)
      .patch(`/api/v1/flights/${flight.id}/status`)
      .send({
        arrival: newArrival.toISOString(),
        departure: newDeparture.toISOString(),
        status: 'DELAYED',
      });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Flight status updated successfully');
    expect(res.body.data.status).toBe('DELAYED');
    expect(res.body.data.departure).toBe(newDeparture.toISOString());
    expect(res.body.data.duration).toBe(360);
  });

  it('refuses an invalid transition', async () => {
    const admin = await createAdmin();
    const flight = await createFlight(); // SCHEDULED

    const res = await authedApi(admin)
      .patch(`/api/v1/flights/${flight.id}/status`)
      .send({ status: 'LANDED' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe(
      'Invalid status transition from SCHEDULED to LANDED. Please follow proper flight status workflow.',
    );
  });
});

describe('DELETE /api/v1/flights/:id', () => {
  it('refuses to delete a flight with an active booking', async () => {
    const admin = await createAdmin();
    const customer = await createUser();
    const flight = await createFlight();
    await createPendingBooking(flight.id, customer.id);

    const res = await authedApi(admin).delete(`/api/v1/flights/${flight.id}`);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe(
      'Cannot delete flight with 1 active booking(s). Please cancel all bookings first.',
    );
  });

  it('lets an admin delete a bookingless flight, which then 404s', async () => {
    const admin = await createAdmin();
    const flight = await createFlight();

    const res = await authedApi(admin).delete(`/api/v1/flights/${flight.id}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Flight deleted successfully');
    expect(res.body.data).toMatchObject({
      flightNumber: flight.flightNumber,
      id: flight.id,
      status: 'SCHEDULED',
    });

    const gone = await authedApi(admin).get(`/api/v1/flights/${flight.id}`);
    expect(gone.status).toBe(404);
  });
});
