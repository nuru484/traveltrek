// test/integration/customer-profile.test.ts
//
// The enriched GET /api/v1/customers/:id stats block (CustomerProfileDTO):
// exact values for every derived field over a seeded scenario — money totals
// from COMPLETED payments only, per-status booking counts, upcoming trips per
// product type (tour start / room check-in / flight departure), last booking,
// favorite destination (with the most-recent tie-break), signup method and
// memberSince — plus the empty-account baseline.
import { describe, expect, it } from 'vitest';

import prisma, {
  BookingStatus,
  PaymentMethod,
  PaymentStatus,
} from '#config/prismaClient.js';

import { authedApi } from '../helpers/auth.js';
import {
  createAgent,
  createCustomer,
  createDestination,
  createFlight,
  createRoom,
  createTour,
} from '../helpers/factories.js';

const DAY_MS = 24 * 60 * 60 * 1000;

let refCounter = 0;

/** A booking row with full control over product/status/dates. */
const seedBooking = (data: {
  customerId: number;
  endDate?: Date;
  flightId?: number;
  roomId?: number;
  startDate?: Date;
  status: BookingStatus;
  totalPrice: number;
  tourId?: number;
}) => prisma.booking.create({ data });

const seedPayment = (data: {
  amount: number;
  bookingId: number;
  customerId: number;
  status: PaymentStatus;
}) =>
  prisma.payment.create({
    data: {
      ...data,
      paymentMethod: PaymentMethod.MOBILE_MONEY,
      transactionReference: `profile-ref-${String(++refCounter)}`,
    },
  });

describe('GET /api/v1/customers/:id — profile stats', () => {
  it('reports the empty-account baseline', async () => {
    const agent = await createAgent();
    const customer = await createCustomer();

    const res = await authedApi(agent).get(
      `/api/v1/customers/${String(customer.id)}`,
    );

    expect(res.status).toBe(200);
    expect(res.body.data.stats).toEqual({
      averageBookingValue: null,
      bookingsByStatus: {},
      favoriteDestination: null,
      lastBookingAt: null,
      memberSince: customer.createdAt.toISOString(),
      signupMethod: 'email',
      totalBookings: 0,
      totalPayments: 0,
      totalSpent: 0,
      upcomingTrips: 0,
    });
  });

  it('computes every stat exactly over a mixed scenario', async () => {
    const agent = await createAgent();
    const customer = await createCustomer();

    const favorite = await createDestination({ name: 'Favorite City' });
    const other = await createDestination({ name: 'One-off Town' });

    // Two tours to the favorite destination: one upcoming CONFIRMED (paid),
    // one already-taken COMPLETED (paid).
    const upcomingTour = await createTour({
      destinationId: favorite.id,
      startDate: new Date(Date.now() + 30 * DAY_MS),
    });
    const pastTour = await createTour({
      destinationId: favorite.id,
      endDate: new Date(Date.now() - 3 * DAY_MS),
      startDate: new Date(Date.now() - 10 * DAY_MS),
    });
    // One tour elsewhere: upcoming but PENDING with a PENDING payment.
    const otherTour = await createTour({
      destinationId: other.id,
      startDate: new Date(Date.now() + 45 * DAY_MS),
    });
    // A CANCELLED future tour must count in neither money nor upcoming
    // (but it still expresses destination interest — same place again).
    const cancelledTour = await createTour({
      destinationId: favorite.id,
      startDate: new Date(Date.now() + 60 * DAY_MS),
    });

    const confirmedUpcoming = await seedBooking({
      customerId: customer.id,
      status: BookingStatus.CONFIRMED,
      totalPrice: 40000,
      tourId: upcomingTour.id,
    });
    const completedPast = await seedBooking({
      customerId: customer.id,
      status: BookingStatus.COMPLETED,
      totalPrice: 20000,
      tourId: pastTour.id,
    });
    const pendingUpcoming = await seedBooking({
      customerId: customer.id,
      status: BookingStatus.PENDING,
      totalPrice: 10000,
      tourId: otherTour.id,
    });
    await seedBooking({
      customerId: customer.id,
      status: BookingStatus.CANCELLED,
      totalPrice: 99000,
      tourId: cancelledTour.id,
    });

    // Money: only COMPLETED payments count toward totalSpent/average.
    await seedPayment({
      amount: 40000,
      bookingId: confirmedUpcoming.id,
      customerId: customer.id,
      status: PaymentStatus.COMPLETED,
    });
    await seedPayment({
      amount: 20000,
      bookingId: completedPast.id,
      customerId: customer.id,
      status: PaymentStatus.COMPLETED,
    });
    await seedPayment({
      amount: 10000,
      bookingId: pendingUpcoming.id,
      customerId: customer.id,
      status: PaymentStatus.PENDING,
    });

    const res = await authedApi(agent).get(
      `/api/v1/customers/${String(customer.id)}`,
    );

    expect(res.status).toBe(200);
    const lastBooking = await prisma.booking.findFirstOrThrow({
      orderBy: { createdAt: 'desc' },
      where: { customerId: customer.id },
    });
    expect(res.body.data.stats).toEqual({
      // 60000 completed pesewas over 2 completed payments.
      averageBookingValue: 30000,
      bookingsByStatus: {
        CANCELLED: 1,
        COMPLETED: 1,
        CONFIRMED: 1,
        PENDING: 1,
      },
      // Favorite City carries 3 bookings to One-off Town's 1.
      favoriteDestination: { id: favorite.id, name: 'Favorite City' },
      lastBookingAt: lastBooking.createdAt.toISOString(),
      memberSince: customer.createdAt.toISOString(),
      signupMethod: 'email',
      totalBookings: 4,
      totalPayments: 3,
      totalSpent: 60000,
      upcomingTrips: 2,
    });
  });

  it('counts future room check-ins and flight departures as upcoming (and ties go to the most recent destination)', async () => {
    const agent = await createAgent();
    const customer = await createCustomer();

    const room = await createRoom();
    const roomBooking = await seedBooking({
      customerId: customer.id,
      endDate: new Date(Date.now() + 7 * DAY_MS),
      roomId: room.id,
      startDate: new Date(Date.now() + 5 * DAY_MS),
      status: BookingStatus.CONFIRMED,
      totalPrice: 30000,
    });
    const flight = await createFlight(); // departs +14d (factory default)
    await seedBooking({
      customerId: customer.id,
      flightId: flight.id,
      status: BookingStatus.PENDING,
      totalPrice: 80000,
    });

    const res = await authedApi(agent).get(
      `/api/v1/customers/${String(customer.id)}`,
    );

    expect(res.status).toBe(200);
    expect(res.body.data.stats.upcomingTrips).toBe(2);
    expect(res.body.data.stats.totalBookings).toBe(2);
    // One booking each — the tie breaks to the most recently booked
    // destination, which is the flight's.
    const flightDestination = await prisma.destination.findUniqueOrThrow({
      where: { id: flight.destinationId },
    });
    expect(res.body.data.stats.favoriteDestination).toEqual({
      id: flightDestination.id,
      name: flightDestination.name,
    });

    // A past check-in stops being "upcoming".
    await prisma.booking.update({
      data: {
        endDate: new Date(Date.now() - 1 * DAY_MS),
        startDate: new Date(Date.now() - 3 * DAY_MS),
      },
      where: { id: roomBooking.id },
    });
    const after = await authedApi(agent).get(
      `/api/v1/customers/${String(customer.id)}`,
    );
    expect(after.body.data.stats.upcomingTrips).toBe(1);
  });

  it('derives signupMethod from googleId / email / phone', async () => {
    const agent = await createAgent();

    const phoneOnly = await prisma.customer.create({
      data: { name: 'Phone Signup', phone: '233550005555' },
    });
    const viaGoogle = await prisma.customer.create({
      data: {
        email: 'google-profile@test.local',
        googleId: 'google-profile-sub',
        name: 'Google Signup',
      },
    });

    const phoneRes = await authedApi(agent).get(
      `/api/v1/customers/${String(phoneOnly.id)}`,
    );
    expect(phoneRes.body.data.stats.signupMethod).toBe('phone');

    // googleId wins even though an email is on file.
    const googleRes = await authedApi(agent).get(
      `/api/v1/customers/${String(viaGoogle.id)}`,
    );
    expect(googleRes.body.data.stats.signupMethod).toBe('google');
  });
});
