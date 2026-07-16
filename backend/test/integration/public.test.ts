// test/integration/public.test.ts
//
// The unauthenticated /api/v1/public browse surface (portfolio landing page):
// every endpoint answers 200 without a token, inventory is public-scoped
// (UPCOMING/ONGOING tours, SCHEDULED future flights), ratings and published
// reviews are embedded, and NO principal data leaks (no customer ids/emails —
// reviews carry a reviewer display name only).
import { describe, expect, it } from 'vitest';

import prisma, {
  BookingStatus,
  FlightStatus,
  ReviewStatus,
  TourStatus,
} from '#config/prismaClient.js';

import { api, authedApi } from '../helpers/auth.js';
import {
  createCustomer,
  createDestination,
  createFlight,
  createHotel,
  createRoom,
  createTour,
} from '../helpers/factories.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/** A published review of a completed tour booking; returns its review row. */
const reviewTour = async (
  customerId: number,
  tourId: number,
  rating: number,
  overrides: { status?: ReviewStatus } = {},
) => {
  const booking = await prisma.booking.create({
    data: {
      customerId,
      status: BookingStatus.COMPLETED,
      totalPrice: 50000,
      tourId,
    },
  });
  return prisma.review.create({
    data: {
      bookingId: booking.id,
      comment: 'Lovely trip end to end.',
      customerId,
      rating,
      status: overrides.status ?? ReviewStatus.PUBLISHED,
      title: 'Great time',
    },
  });
};

describe('GET /api/v1/public/destinations', () => {
  it('answers unauthenticated with minimal fields and pagination meta', async () => {
    await createDestination({ name: 'Accra' });
    await createDestination({ name: 'Kumasi' });

    const res = await api().get('/api/v1/public/destinations');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta.total).toBe(2);
    expect(res.body.data[0]).toHaveProperty('photo');
    // Minimal public shape: no timestamps.
    expect(res.body.data[0]).not.toHaveProperty('createdAt');
  });
});

describe('GET /api/v1/public/tours', () => {
  it('lists only UPCOMING/ONGOING tours with destination, photo and rating', async () => {
    const upcoming = await createTour({ name: 'Upcoming Trek' });
    const completed = await createTour({ name: 'Completed Trek' });
    await prisma.tour.update({
      data: { status: TourStatus.COMPLETED },
      where: { id: completed.id },
    });
    const cancelled = await createTour({ name: 'Cancelled Trek' });
    await prisma.tour.update({
      data: { status: TourStatus.CANCELLED },
      where: { id: cancelled.id },
    });

    const res = await api().get('/api/v1/public/tours');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(upcoming.id);
    expect(res.body.data[0].destination.name).toBeDefined();
    expect(res.body.data[0]).toHaveProperty('photo');
    expect(res.body.data[0].rating).toEqual({ average: null, count: 0 });
  });

  it('filters by search', async () => {
    await createTour({ name: 'Savannah Safari' });
    await createTour({ name: 'Coastal Cruise' });

    const res = await api().get('/api/v1/public/tours?search=Savannah');

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Savannah Safari');
  });
});

describe('GET /api/v1/public/tours/:id', () => {
  it('embeds the rating and the first page of published reviews', async () => {
    const tour = await createTour();
    const alice = await createCustomer();
    const bob = await createCustomer();
    await reviewTour(alice.id, tour.id, 5);
    await reviewTour(bob.id, tour.id, 2, { status: ReviewStatus.HIDDEN });

    const res = await api().get(`/api/v1/public/tours/${tour.id}`);

    expect(res.status).toBe(200);
    // HIDDEN reviews feed neither the aggregate nor the list.
    expect(res.body.data.rating).toEqual({ average: 5, count: 1 });
    expect(res.body.data.reviews).toHaveLength(1);
    expect(res.body.data.reviewsTotal).toBe(1);
    expect(res.body.data.reviews[0].reviewer).toBe(alice.name);
  });

  it('404s for a missing tour', async () => {
    const res = await api().get('/api/v1/public/tours/999999');
    expect(res.status).toBe(404);
  });
});

describe('GET /api/v1/public/hotels(/:id)', () => {
  it('lists hotels with destination and rating', async () => {
    await createHotel({ name: 'Harbourlight' });

    const res = await api().get('/api/v1/public/hotels');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].destination).toBeDefined();
    expect(res.body.data[0].rating).toEqual({ average: null, count: 0 });
  });

  it('embeds rooms summary, rating and reviews on the detail', async () => {
    const room = await createRoom();
    const customer = await createCustomer();
    const stayStart = new Date(Date.now() - 9 * DAY_MS);
    const booking = await prisma.booking.create({
      data: {
        customerId: customer.id,
        endDate: new Date(stayStart.getTime() + 2 * DAY_MS),
        roomId: room.id,
        startDate: stayStart,
        status: BookingStatus.COMPLETED,
        totalPrice: 30000,
      },
    });
    await prisma.review.create({
      data: {
        bookingId: booking.id,
        customerId: customer.id,
        rating: 4,
        title: 'Comfortable stay',
      },
    });

    const res = await api().get(`/api/v1/public/hotels/${room.hotelId}`);

    expect(res.status).toBe(200);
    expect(res.body.data.rooms).toHaveLength(1);
    expect(res.body.data.rating).toEqual({ average: 4, count: 1 });
    expect(res.body.data.reviews).toHaveLength(1);
    expect(res.body.data.reviews[0].target.type).toBe('ROOM');
  });
});

describe('GET /api/v1/public/flights(/:id)', () => {
  it('lists only SCHEDULED flights that have not departed', async () => {
    const future = await createFlight();
    const departed = await createFlight();
    await prisma.flight.update({
      data: { status: FlightStatus.DEPARTED },
      where: { id: departed.id },
    });
    const pastScheduled = await createFlight();
    await prisma.flight.update({
      data: {
        arrival: new Date(Date.now() - 4 * DAY_MS),
        departure: new Date(Date.now() - 5 * DAY_MS),
      },
      where: { id: pastScheduled.id },
    });

    const res = await api().get('/api/v1/public/flights');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(future.id);
    expect(res.body.data[0].rating).toEqual({ average: null, count: 0 });
  });

  it('serves the flight detail with reviews block', async () => {
    const flight = await createFlight();

    const res = await api().get(`/api/v1/public/flights/${flight.id}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(flight.id);
    expect(res.body.data.reviews).toEqual([]);
    expect(res.body.data.rating).toEqual({ average: null, count: 0 });
  });
});

describe('GET /api/v1/public/reviews/recent', () => {
  it('returns the latest published reviews with reviewer names only', async () => {
    const tourA = await createTour();
    const tourB = await createTour();
    const alice = await createCustomer();
    const bob = await createCustomer();
    await reviewTour(alice.id, tourA.id, 5);
    await reviewTour(bob.id, tourB.id, 4, { status: ReviewStatus.HIDDEN });

    const res = await api().get('/api/v1/public/reviews/recent');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].reviewer).toBe(alice.name);
    expect(res.body.data[0].target.type).toBe('TOUR');
  });

  it('caps the requested limit', async () => {
    const res = await api().get('/api/v1/public/reviews/recent?limit=999');
    expect(res.status).toBe(400);
  });
});

describe('public surface privacy and access', () => {
  it('never leaks customer ids or emails on public reviews', async () => {
    const tour = await createTour();
    const customer = await createCustomer();
    await reviewTour(customer.id, tour.id, 5);

    const detail = await api().get(`/api/v1/public/tours/${tour.id}`);
    const recent = await api().get('/api/v1/public/reviews/recent');

    for (const body of [detail.body, recent.body]) {
      const raw = JSON.stringify(body);
      expect(raw).not.toContain(customer.email!);
      expect(raw).not.toContain('"customerId"');
      expect(raw).not.toContain('"customer"');
      expect(raw).not.toContain('"booking"');
    }
  });

  it('requires no token and survives a burst (limiter skipped in tests)', async () => {
    await createDestination();
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        api().get('/api/v1/public/destinations'),
      ),
    );
    for (const res of results) expect(res.status).toBe(200);
  });

  it('keeps the authed tour surface gated (public split does not leak)', async () => {
    const tour = await createTour();
    const unauth = await api().get(`/api/v1/tours/${tour.id}`);
    expect(unauth.status).toBe(401);

    const customer = await createCustomer();
    const authed = await authedApi(customer).get(`/api/v1/tours/${tour.id}`);
    expect(authed.status).toBe(200);
  });
});
