// test/integration/rooms.test.ts
//
// Behaviour of the room CRUD surface after the service-layer refactor: role
// gates, validation, pagination, filters, availability counts and the
// booking-aware delete guards.
import { describe, expect, it } from 'vitest';

import prisma, { BookingStatus } from '#config/prismaClient.js';

import { authedApi } from '../helpers/auth.js';
import {
  createAdmin,
  createHotel,
  createRoom,
  createUser,
} from '../helpers/factories.js';

const roomPayload = (hotelId: number) => ({
  amenities: ['wifi', 'tv'],
  capacity: 2,
  description: 'A cosy seaside test room',
  hotelId,
  pricePerNight: 150,
  roomType: 'DELUXE',
  totalRooms: 5,
});

/** A PENDING room booking placed directly in the DB (a week-long stay soon). */
const createPendingBooking = async (roomId: number, userId: number) => {
  const startDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const endDate = new Date(startDate.getTime() + 3 * 24 * 60 * 60 * 1000);
  return prisma.booking.create({
    data: {
      endDate,
      numberOfRooms: 1,
      roomId,
      startDate,
      status: BookingStatus.PENDING,
      totalPrice: 450,
      userId,
    },
  });
};

describe('POST /api/v1/rooms', () => {
  it('lets an admin create a room', async () => {
    const admin = await createAdmin();
    const hotel = await createHotel();

    const res = await authedApi(admin)
      .post('/api/v1/rooms')
      .send(roomPayload(hotel.id));

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Room created successfully');
    expect(res.body.data).toMatchObject({
      amenities: ['wifi', 'tv'],
      capacity: 2,
      hotel: { id: hotel.id, name: hotel.name },
      pricePerNight: 150,
      roomsAvailable: 5,
      roomsBooked: 0,
      roomType: 'DELUXE',
      totalRooms: 5,
    });
  });

  it('forbids customers from creating rooms', async () => {
    const customer = await createUser();
    const hotel = await createHotel();

    const res = await authedApi(customer)
      .post('/api/v1/rooms')
      .send(roomPayload(hotel.id));

    expect(res.status).toBe(403);
  });

  it('rejects an invalid payload with field errors', async () => {
    const admin = await createAdmin();
    const res = await authedApi(admin).post('/api/v1/rooms').send({
      capacity: 0,
      roomType: '',
    });
    expect(res.status).toBe(400);
    expect(res.body.status).toBe('error');
  });
});

describe('GET /api/v1/rooms', () => {
  it('returns a paginated list with meta', async () => {
    const customer = await createUser();
    for (let i = 0; i < 3; i++) {
      await createRoom();
    }

    const res = await authedApi(customer).get('/api/v1/rooms?page=1&limit=2');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta).toMatchObject({
      limit: 2,
      page: 1,
      total: 3,
      totalPages: 2,
    });
  });

  it('filters by hotel', async () => {
    const customer = await createUser();
    const hotel = await createHotel();
    await createRoom({ hotelId: hotel.id });
    await createRoom({ hotelId: hotel.id });
    await createRoom(); // a room elsewhere

    const res = await authedApi(customer).get(
      `/api/v1/rooms?hotelId=${hotel.id}`,
    );

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });
});

describe('GET /api/v1/rooms/:id', () => {
  it('returns a room by id with availability counts', async () => {
    const customer = await createUser();
    const room = await createRoom({ totalRooms: 4 });

    const res = await authedApi(customer).get(`/api/v1/rooms/${room.id}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(room.id);
    expect(res.body.data.roomsAvailable).toBe(4);
    expect(res.body.data.roomsBooked).toBe(0);
  });

  it('404s for a missing room', async () => {
    const customer = await createUser();
    const res = await authedApi(customer).get('/api/v1/rooms/999999');
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/v1/rooms/:id', () => {
  it('lets an admin update a room', async () => {
    const admin = await createAdmin();
    const room = await createRoom();

    const res = await authedApi(admin)
      .put(`/api/v1/rooms/${room.id}`)
      .send({ capacity: 3, pricePerNight: 200 });

    expect(res.status).toBe(200);
    expect(res.body.data.pricePerNight).toBe(200);
    expect(res.body.data.capacity).toBe(3);
  });

  it('forbids customers from updating rooms', async () => {
    const customer = await createUser();
    const room = await createRoom();
    const res = await authedApi(customer)
      .put(`/api/v1/rooms/${room.id}`)
      .send({ pricePerNight: 1 });
    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/v1/rooms/:id', () => {
  it('refuses to delete a room with an active booking', async () => {
    const admin = await createAdmin();
    const customer = await createUser();
    const room = await createRoom();
    await createPendingBooking(room.id, customer.id);

    const res = await authedApi(admin).delete(`/api/v1/rooms/${room.id}`);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe(
      'Cannot delete room with 1 active booking(s). Please cancel or complete all bookings first.',
    );
  });

  it('lets an admin delete a bookingless room, which then 404s', async () => {
    const admin = await createAdmin();
    const hotel = await createHotel();
    const room = await createRoom({ hotelId: hotel.id });
    // A second room, so the "last room of the hotel" guard doesn't fire.
    await createRoom({ hotelId: hotel.id });

    const res = await authedApi(admin).delete(`/api/v1/rooms/${room.id}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Room deleted successfully');
    expect(res.body.data).toMatchObject({
      hotelName: hotel.name,
      id: room.id,
    });

    const gone = await authedApi(admin).get(`/api/v1/rooms/${room.id}`);
    expect(gone.status).toBe(404);
  });
});
