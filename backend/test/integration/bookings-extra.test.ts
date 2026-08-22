// test/integration/bookings-extra.test.ts
//
// Coverage the baseline bookings suite lacks: room and flight booking happy
// paths (price/nights math, seat and availability accounting), admin updates
// (guest counts, the status guard rails), and the role rules on the per-user
// listing endpoint.
import { describe, expect, it } from 'vitest';

import prisma from '#config/prismaClient.js';

import { authedApi } from '../helpers/auth.js';
import {
  createAdmin,
  createCustomer,
  createFlight,
  createRoom,
  createTour,
} from '../helpers/factories.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const inDays = (days: number) => new Date(Date.now() + days * DAY_MS);

describe('POST /api/v1/bookings (rooms)', () => {
  it('books a room for a date window and derives nights and price', async () => {
    const customer = await createCustomer();
    const room = await createRoom({ pricePerNight: 150, totalRooms: 5 });

    const res = await authedApi(customer).post('/api/v1/bookings').send({
      customerId: customer.id,
      endDate: inDays(13).toISOString(),
      numberOfGuests: 4,
      numberOfRooms: 2,
      roomId: room.id,
      startDate: inDays(10).toISOString(),
      totalPrice: 1,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.type).toBe('ROOM');
    expect(res.body.data.room.id).toBe(room.id);
    expect(res.body.data.room.numberOfRooms).toBe(2);
    expect(res.body.data.room.numberOfNights).toBe(3);
    // Price is server-derived: 150/night * 3 nights * 2 rooms.
    expect(res.body.data.totalPrice).toBe(900);
    expect(res.body.data.bookingDetails.numberOfNights).toBe(3);
    expect(res.body.data.bookingDetails.calculatedPrice).toBe(900);
    expect(res.body.data.bookingDetails.requiresImmediatePayment).toBe(false);
  });

  it('counts held rooms against availability for overlapping dates', async () => {
    const customerA = await createCustomer();
    const customerB = await createCustomer();
    const room = await createRoom({ totalRooms: 5 });

    const first = await authedApi(customerA).post('/api/v1/bookings').send({
      customerId: customerA.id,
      endDate: inDays(13).toISOString(),
      numberOfRooms: 3,
      roomId: room.id,
      startDate: inDays(10).toISOString(),
      totalPrice: 1,
    });
    expect(first.status).toBe(201);

    // 3 of 5 rooms are held for the window; a further 3 must be refused.
    const second = await authedApi(customerB).post('/api/v1/bookings').send({
      customerId: customerB.id,
      endDate: inDays(13).toISOString(),
      numberOfRooms: 3,
      roomId: room.id,
      startDate: inDays(10).toISOString(),
      totalPrice: 1,
    });

    expect(second.status).toBe(400);
    expect(second.body.message).toContain('Only 2 room(s) available');
  });

  it('rejects a room booking with a check-in date in the past', async () => {
    const customer = await createCustomer();
    const room = await createRoom();

    const res = await authedApi(customer).post('/api/v1/bookings').send({
      customerId: customer.id,
      endDate: inDays(2).toISOString(),
      roomId: room.id,
      startDate: inDays(-2).toISOString(),
      totalPrice: 1,
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Check-in date cannot be in the past');
  });
});

describe('POST /api/v1/bookings (flights)', () => {
  it('books seats on a flight and decrements seatsAvailable', async () => {
    const customer = await createCustomer();
    const flight = await createFlight({ capacity: 100, price: 800 });

    const res = await authedApi(customer).post('/api/v1/bookings').send({
      customerId: customer.id,
      flightId: flight.id,
      numberOfGuests: 2,
      totalPrice: 1,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.type).toBe('FLIGHT');
    expect(res.body.data.flight.id).toBe(flight.id);
    // Price is server-derived: 800/seat * 2 seats.
    expect(res.body.data.totalPrice).toBe(1600);
    expect(res.body.data.bookingDetails.flightDeparture).toBeDefined();

    const updated = await prisma.flight.findUnique({
      where: { id: flight.id },
    });
    expect(updated?.seatsAvailable).toBe(98);
  });

  it('rejects a booking beyond the remaining seats', async () => {
    const customer = await createCustomer();
    const flight = await createFlight({ capacity: 3 });

    const res = await authedApi(customer).post('/api/v1/bookings').send({
      customerId: customer.id,
      flightId: flight.id,
      numberOfGuests: 4,
      totalPrice: 1,
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Only 3 seat(s) available');
  });
});

describe('PUT /api/v1/bookings/:id', () => {
  it('lets an admin change the guest count and re-syncs the tour counter', async () => {
    const admin = await createAdmin();
    const customer = await createCustomer();
    const tour = await createTour({ maxGuests: 10, price: 500 });

    const created = await authedApi(customer).post('/api/v1/bookings').send({
      customerId: customer.id,
      numberOfGuests: 2,
      totalPrice: 1000,
      tourId: tour.id,
    });
    expect(created.status).toBe(201);

    const res = await authedApi(admin)
      .put(`/api/v1/bookings/${created.body.data.id}`)
      .send({ numberOfGuests: 4 });

    expect(res.status).toBe(200);
    expect(res.body.data.numberOfGuests).toBe(4);
    expect(res.body.data.totalPrice).toBe(2000);

    const updatedTour = await prisma.tour.findUnique({
      where: { id: tour.id },
    });
    expect(updatedTour?.guestsBooked).toBe(4);
  });

  it('lets an admin cancel a pending booking', async () => {
    const admin = await createAdmin();
    const customer = await createCustomer();
    const tour = await createTour();

    const created = await authedApi(customer).post('/api/v1/bookings').send({
      customerId: customer.id,
      numberOfGuests: 1,
      totalPrice: 500,
      tourId: tour.id,
    });

    const res = await authedApi(admin)
      .put(`/api/v1/bookings/${created.body.data.id}`)
      .send({ status: 'CANCELLED' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('CANCELLED');
  });

  it('refuses to confirm a booking without a completed payment', async () => {
    const admin = await createAdmin();
    const customer = await createCustomer();
    const tour = await createTour();

    const created = await authedApi(customer).post('/api/v1/bookings').send({
      customerId: customer.id,
      numberOfGuests: 1,
      totalPrice: 500,
      tourId: tour.id,
    });

    const res = await authedApi(admin)
      .put(`/api/v1/bookings/${created.body.data.id}`)
      .send({ status: 'CONFIRMED' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe(
      'Cannot change booking status to CONFIRMED without a completed payment',
    );
  });

  it('refuses to modify a cancelled booking', async () => {
    const admin = await createAdmin();
    const customer = await createCustomer();
    const tour = await createTour();

    const created = await authedApi(customer).post('/api/v1/bookings').send({
      customerId: customer.id,
      numberOfGuests: 1,
      totalPrice: 500,
      tourId: tour.id,
    });
    await authedApi(admin)
      .put(`/api/v1/bookings/${created.body.data.id}`)
      .send({ status: 'CANCELLED' });

    const res = await authedApi(admin)
      .put(`/api/v1/bookings/${created.body.data.id}`)
      .send({ numberOfGuests: 3 });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Cannot modify cancelled bookings');
  });
});

describe('GET /api/v1/bookings/customer/:customerId', () => {
  it('lets a customer list their own bookings', async () => {
    const customer = await createCustomer();
    const tour = await createTour();

    await authedApi(customer).post('/api/v1/bookings').send({
      customerId: customer.id,
      numberOfGuests: 1,
      totalPrice: 500,
      tourId: tour.id,
    });

    const res = await authedApi(customer).get(
      `/api/v1/bookings/customer/${customer.id}`,
    );

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].customerId).toBe(customer.id);
    expect(res.body.meta.total).toBe(1);
  });

  it("blocks a customer from listing another user's bookings", async () => {
    const customerA = await createCustomer();
    const customerB = await createCustomer();

    const res = await authedApi(customerA).get(
      `/api/v1/bookings/customer/${customerB.id}`,
    );

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('You can only view your own bookings');
  });

  it("lets an admin list any user's bookings", async () => {
    const admin = await createAdmin();
    const customer = await createCustomer();
    const tour = await createTour();

    await authedApi(customer).post('/api/v1/bookings').send({
      customerId: customer.id,
      numberOfGuests: 1,
      totalPrice: 500,
      tourId: tour.id,
    });

    const res = await authedApi(admin).get(
      `/api/v1/bookings/customer/${customer.id}`,
    );

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].customerId).toBe(customer.id);
  });
});

describe('booking staff attribution (createdBy)', () => {
  it('records the staff creator when an admin books on behalf of a customer', async () => {
    const admin = await createAdmin();
    const customer = await createCustomer();
    const tour = await createTour();

    const res = await authedApi(admin).post('/api/v1/bookings').send({
      customerId: customer.id,
      numberOfGuests: 1,
      totalPrice: 500,
      tourId: tour.id,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.createdBy).toEqual({
      id: admin.id,
      name: admin.name,
    });

    const row = await prisma.booking.findUnique({
      where: { id: res.body.data.id },
    });
    expect(row?.createdByUserId).toBe(admin.id);
  });

  it('leaves createdBy null for a customer self-booking', async () => {
    const customer = await createCustomer();
    const tour = await createTour();

    const res = await authedApi(customer).post('/api/v1/bookings').send({
      customerId: customer.id,
      numberOfGuests: 1,
      totalPrice: 500,
      tourId: tour.id,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.createdBy).toBeNull();

    const row = await prisma.booking.findUnique({
      where: { id: res.body.data.id },
    });
    expect(row?.createdByUserId).toBeNull();
  });
});
