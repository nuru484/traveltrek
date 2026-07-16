// test/integration/reviews.test.ts
//
// The reviews domain: create rules (own booking, COMPLETED only, one per
// booking, rating bounds), the 30-day edit window, ownership on
// update/delete, admin moderation, the /mine and staff listings, and the
// rating aggregates feeding the tour/hotel/flight DTOs.
import { describe, expect, it } from 'vitest';

import prisma, {
  BookingStatus,
  ReviewStatus,
} from '#config/prismaClient.js';

import { authedApi } from '../helpers/auth.js';
import {
  createAdmin,
  createAgent,
  createCustomer,
  createFlight,
  createRoom,
  createTour,
} from '../helpers/factories.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/** A COMPLETED tour booking owned by the customer — reviewable. */
const completedTourBooking = async (
  customerId: number,
  tourId?: number,
): Promise<{ bookingId: number; tourId: number }> => {
  const resolvedTourId = tourId ?? (await createTour()).id;
  const booking = await prisma.booking.create({
    data: {
      customerId,
      numberOfGuests: 2,
      status: BookingStatus.COMPLETED,
      totalPrice: 100000,
      tourId: resolvedTourId,
    },
  });
  return { bookingId: booking.id, tourId: resolvedTourId };
};

/** Shortcut: post a review for a fresh completed booking, return the body. */
const postReview = async (
  customer: { id: number },
  overrides: Record<string, unknown> = {},
) => {
  const { bookingId, tourId } = await completedTourBooking(customer.id);
  const res = await authedApi(customer)
    .post('/api/v1/reviews')
    .send({ bookingId, rating: 5, title: 'Wonderful', ...overrides });
  return { bookingId, res, tourId };
};

describe('POST /api/v1/reviews', () => {
  it('lets a customer review their own completed booking', async () => {
    const customer = await createCustomer();
    const { res } = await postReview(customer, {
      comment: 'Everything was perfect.',
      rating: 4,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.rating).toBe(4);
    expect(res.body.data.title).toBe('Wonderful');
    expect(res.body.data.status).toBe('PUBLISHED');
    expect(res.body.data.target.type).toBe('TOUR');
    expect(res.body.data.customer).toEqual({
      id: customer.id,
      name: customer.name,
    });
  });

  it('refuses to review a booking that is not COMPLETED', async () => {
    const customer = await createCustomer();
    const tour = await createTour();
    const booking = await prisma.booking.create({
      data: {
        customerId: customer.id,
        status: BookingStatus.PENDING,
        totalPrice: 50000,
        tourId: tour.id,
      },
    });

    const res = await authedApi(customer)
      .post('/api/v1/reviews')
      .send({ bookingId: booking.id, rating: 5 });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Only completed bookings can be reviewed');
  });

  it('409s on a second review of the same booking', async () => {
    const customer = await createCustomer();
    const { bookingId, res } = await postReview(customer);
    expect(res.status).toBe(201);

    const dup = await authedApi(customer)
      .post('/api/v1/reviews')
      .send({ bookingId, rating: 3 });

    expect(dup.status).toBe(409);
    expect(dup.body.message).toBe('This booking has already been reviewed');
  });

  it("refuses to review another customer's booking", async () => {
    const owner = await createCustomer();
    const intruder = await createCustomer();
    const { bookingId } = await completedTourBooking(owner.id);

    const res = await authedApi(intruder)
      .post('/api/v1/reviews')
      .send({ bookingId, rating: 5 });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('You can only review your own bookings');
  });

  it('rejects an out-of-range rating with field errors', async () => {
    const customer = await createCustomer();
    const { bookingId } = await completedTourBooking(customer.id);

    const res = await authedApi(customer)
      .post('/api/v1/reviews')
      .send({ bookingId, rating: 6 });

    expect(res.status).toBe(400);
  });

  it('forbids staff from creating reviews', async () => {
    const agent = await createAgent();
    const res = await authedApi(agent)
      .post('/api/v1/reviews')
      .send({ bookingId: 1, rating: 5 });
    expect(res.status).toBe(403);
  });
});

describe('PUT /api/v1/reviews/:id', () => {
  it('lets the author edit within 30 days', async () => {
    const customer = await createCustomer();
    const { res } = await postReview(customer);

    const updated = await authedApi(customer)
      .put(`/api/v1/reviews/${res.body.data.id}`)
      .send({ comment: 'Updated thoughts.', rating: 3 });

    expect(updated.status).toBe(200);
    expect(updated.body.data.rating).toBe(3);
    expect(updated.body.data.comment).toBe('Updated thoughts.');
  });

  it('refuses edits after the 30-day window', async () => {
    const customer = await createCustomer();
    const { res } = await postReview(customer);

    // Age the review past the window.
    await prisma.review.update({
      data: { createdAt: new Date(Date.now() - 31 * DAY_MS) },
      where: { id: res.body.data.id },
    });

    const updated = await authedApi(customer)
      .put(`/api/v1/reviews/${res.body.data.id}`)
      .send({ rating: 1 });

    expect(updated.status).toBe(400);
    expect(updated.body.message).toBe(
      'Reviews can only be edited within 30 days of posting',
    );
  });

  it("refuses to edit another customer's review", async () => {
    const author = await createCustomer();
    const intruder = await createCustomer();
    const { res } = await postReview(author);

    const updated = await authedApi(intruder)
      .put(`/api/v1/reviews/${res.body.data.id}`)
      .send({ rating: 1 });

    expect(updated.status).toBe(401);
  });
});

describe('DELETE /api/v1/reviews/:id', () => {
  it('soft-deletes the author’s own review', async () => {
    const customer = await createCustomer();
    const { res } = await postReview(customer);

    const del = await authedApi(customer).delete(
      `/api/v1/reviews/${res.body.data.id}`,
    );
    expect(del.status).toBe(200);

    // findUnique is the deliberate unscoped seam — the tombstone survives.
    const row = await prisma.review.findUnique({
      where: { id: res.body.data.id },
    });
    expect(row?.deletedAt).not.toBeNull();

    const again = await authedApi(customer).delete(
      `/api/v1/reviews/${res.body.data.id}`,
    );
    expect(again.status).toBe(404);
  });

  it('lets an ADMIN delete any review', async () => {
    const admin = await createAdmin();
    const customer = await createCustomer();
    const { res } = await postReview(customer);

    const del = await authedApi(admin).delete(
      `/api/v1/reviews/${res.body.data.id}`,
    );
    expect(del.status).toBe(200);
  });

  it("refuses another customer's delete", async () => {
    const author = await createCustomer();
    const intruder = await createCustomer();
    const { res } = await postReview(author);

    const del = await authedApi(intruder).delete(
      `/api/v1/reviews/${res.body.data.id}`,
    );
    expect(del.status).toBe(401);
  });
});

describe('PATCH /api/v1/reviews/:id/status', () => {
  it('lets an ADMIN hide and re-publish a review', async () => {
    const admin = await createAdmin();
    const customer = await createCustomer();
    const { res } = await postReview(customer);

    const hidden = await authedApi(admin)
      .patch(`/api/v1/reviews/${res.body.data.id}/status`)
      .send({ status: 'HIDDEN' });
    expect(hidden.status).toBe(200);
    expect(hidden.body.data.status).toBe('HIDDEN');

    const republished = await authedApi(admin)
      .patch(`/api/v1/reviews/${res.body.data.id}/status`)
      .send({ status: 'PUBLISHED' });
    expect(republished.body.data.status).toBe('PUBLISHED');
  });

  it('forbids agents from moderating', async () => {
    const agent = await createAgent();
    const customer = await createCustomer();
    const { res } = await postReview(customer);

    const hidden = await authedApi(agent)
      .patch(`/api/v1/reviews/${res.body.data.id}/status`)
      .send({ status: 'HIDDEN' });
    expect(hidden.status).toBe(403);
  });
});

describe('GET /api/v1/reviews/mine and GET /api/v1/reviews', () => {
  it("returns only the customer's own reviews on /mine", async () => {
    const alice = await createCustomer();
    const bob = await createCustomer();
    await postReview(alice);
    await postReview(bob);

    const res = await authedApi(alice).get('/api/v1/reviews/mine');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].customer.id).toBe(alice.id);
    expect(res.body.meta.total).toBe(1);
  });

  it('lets staff list all reviews and filter by status and rating', async () => {
    const admin = await createAdmin();
    const customer = await createCustomer();
    const first = await postReview(customer, { rating: 5 });
    await postReview(customer, { rating: 2 });

    await prisma.review.update({
      data: { status: ReviewStatus.HIDDEN },
      where: { id: first.res.body.data.id },
    });

    const all = await authedApi(admin).get('/api/v1/reviews');
    expect(all.status).toBe(200);
    expect(all.body.data).toHaveLength(2);

    const hidden = await authedApi(admin).get('/api/v1/reviews?status=HIDDEN');
    expect(hidden.body.data).toHaveLength(1);
    expect(hidden.body.data[0].status).toBe('HIDDEN');

    const twoStar = await authedApi(admin).get('/api/v1/reviews?rating=2');
    expect(twoStar.body.data).toHaveLength(1);
    expect(twoStar.body.data[0].rating).toBe(2);
  });

  it('forbids customers from the staff listing', async () => {
    const customer = await createCustomer();
    const res = await authedApi(customer).get('/api/v1/reviews');
    expect(res.status).toBe(403);
  });
});

describe('rating aggregates on tour/hotel/flight DTOs', () => {
  it('feeds the tour detail and list DTOs (published, live rows only)', async () => {
    const admin = await createAdmin();
    const tour = await createTour();
    const alice = await createCustomer();
    const bob = await createCustomer();

    const a = await completedTourBooking(alice.id, tour.id);
    const b = await completedTourBooking(bob.id, tour.id);
    await authedApi(alice)
      .post('/api/v1/reviews')
      .send({ bookingId: a.bookingId, rating: 5 });
    const bobReview = await authedApi(bob)
      .post('/api/v1/reviews')
      .send({ bookingId: b.bookingId, rating: 2 });

    const detail = await authedApi(admin).get(`/api/v1/tours/${tour.id}`);
    expect(detail.body.data.rating).toEqual({ average: 3.5, count: 2 });

    const list = await authedApi(admin).get('/api/v1/tours');
    const rows = list.body.data as { id: number; rating: unknown }[];
    const listed = rows.find((t) => t.id === tour.id);
    expect(listed?.rating).toEqual({ average: 3.5, count: 2 });

    // Hiding a review removes it from the aggregate.
    await authedApi(admin)
      .patch(`/api/v1/reviews/${bobReview.body.data.id}/status`)
      .send({ status: 'HIDDEN' });
    const after = await authedApi(admin).get(`/api/v1/tours/${tour.id}`);
    expect(after.body.data.rating).toEqual({ average: 5, count: 1 });
  });

  it('feeds hotel (via rooms) and flight rating blocks', async () => {
    const admin = await createAdmin();
    const customer = await createCustomer();
    const room = await createRoom();
    const flight = await createFlight();

    const stayStart = new Date(Date.now() - 10 * DAY_MS);
    const roomBooking = await prisma.booking.create({
      data: {
        customerId: customer.id,
        endDate: new Date(stayStart.getTime() + 2 * DAY_MS),
        roomId: room.id,
        startDate: stayStart,
        status: BookingStatus.COMPLETED,
        totalPrice: 30000,
      },
    });
    const flightBooking = await prisma.booking.create({
      data: {
        customerId: customer.id,
        flightId: flight.id,
        status: BookingStatus.COMPLETED,
        totalPrice: 80000,
      },
    });

    await authedApi(customer)
      .post('/api/v1/reviews')
      .send({ bookingId: roomBooking.id, rating: 4 });
    await authedApi(customer)
      .post('/api/v1/reviews')
      .send({ bookingId: flightBooking.id, rating: 3 });

    const hotel = await authedApi(admin).get(
      `/api/v1/hotels/${room.hotelId}`,
    );
    expect(hotel.body.data.rating).toEqual({ average: 4, count: 1 });

    const flightRes = await authedApi(admin).get(
      `/api/v1/flights/${flight.id}`,
    );
    expect(flightRes.body.data.rating).toEqual({ average: 3, count: 1 });
  });
});
