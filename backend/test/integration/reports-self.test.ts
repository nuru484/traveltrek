// test/integration/reports-self.test.ts
//
// Per-role self reports. /reports/me aggregates the authenticated customer's
// own activity (COMPLETED trips, upcoming, cancellations, COMPLETED-payment
// spend, zero-filled monthly buckets, per-type breakdown, last-5 DTOs);
// /reports/agent-activity aggregates the bookings a staff member recorded
// (createdByUserId), with agents pinned to themselves and ADMIN allowed a
// ?userId= override. Rows are seeded directly through Prisma with mid-month
// UTC-noon dates so the month buckets are deterministic, and both scenarios
// include another principal's rows to prove scoping.
import { describe, expect, it } from 'vitest';

import prisma, {
  BookingStatus,
  PaymentMethod,
  PaymentStatus,
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

const YEAR = 2026;

const seedCustomerScenario = async () => {
  const customer = await createCustomer();
  const other = await createCustomer();

  const [tourA, tourB, noiseTour] = await Promise.all([
    createTour(), // future startDate (default: +30d)
    createTour(),
    createTour(),
  ]);
  const room = await createRoom();
  const flight = await createFlight(); // departure +14d (future)

  // COMPLETED tour trip, Feb — counts as a trip taken.
  const completedTour = await prisma.booking.create({
    data: {
      bookingDate: new Date('2026-02-15T12:00:00Z'),
      customerId: customer.id,
      status: BookingStatus.COMPLETED,
      totalPrice: 50_000,
      tourId: tourA.id,
    },
  });
  // CANCELLED room stay, Mar.
  await prisma.booking.create({
    data: {
      bookingDate: new Date('2026-03-15T12:00:00Z'),
      customerId: customer.id,
      endDate: new Date('2026-04-03T00:00:00Z'),
      roomId: room.id,
      startDate: new Date('2026-04-01T00:00:00Z'),
      status: BookingStatus.CANCELLED,
      totalPrice: 30_000,
    },
  });
  // CONFIRMED future flight, May — upcoming.
  const confirmedFlight = await prisma.booking.create({
    data: {
      bookingDate: new Date('2026-05-15T12:00:00Z'),
      customerId: customer.id,
      flightId: flight.id,
      status: BookingStatus.CONFIRMED,
      totalPrice: 80_000,
    },
  });
  // PENDING future tour, May — upcoming too.
  await prisma.booking.create({
    data: {
      bookingDate: new Date('2026-05-20T12:00:00Z'),
      customerId: customer.id,
      status: BookingStatus.PENDING,
      totalPrice: 20_000,
      tourId: tourB.id,
    },
  });

  // COMPLETED payments: Feb 50_000 + May 80_000 → totalSpent 130_000.
  await prisma.payment.create({
    data: {
      amount: 50_000,
      bookingId: completedTour.id,
      customerId: customer.id,
      paymentDate: new Date('2026-02-16T12:00:00Z'),
      paymentMethod: PaymentMethod.MOBILE_MONEY,
      status: PaymentStatus.COMPLETED,
    },
  });
  await prisma.payment.create({
    data: {
      amount: 80_000,
      bookingId: confirmedFlight.id,
      customerId: customer.id,
      paymentDate: new Date('2026-05-16T12:00:00Z'),
      paymentMethod: PaymentMethod.CREDIT_CARD,
      status: PaymentStatus.COMPLETED,
    },
  });

  // Another customer's activity must never leak into the report.
  const noise = await prisma.booking.create({
    data: {
      bookingDate: new Date('2026-05-15T12:00:00Z'),
      customerId: other.id,
      status: BookingStatus.COMPLETED,
      totalPrice: 999_999,
      tourId: noiseTour.id,
    },
  });
  await prisma.payment.create({
    data: {
      amount: 999_999,
      bookingId: noise.id,
      customerId: other.id,
      paymentDate: new Date('2026-05-15T12:00:00Z'),
      paymentMethod: PaymentMethod.CREDIT_CARD,
      status: PaymentStatus.COMPLETED,
    },
  });

  return customer;
};

describe('GET /api/v1/reports/me', () => {
  it('aggregates the acting customer with exact numbers', async () => {
    const customer = await seedCustomerScenario();

    const res = await authedApi(customer).get(
      `/api/v1/reports/me?year=${YEAR}`,
    );

    expect(res.status).toBe(200);
    expect(res.body.data.summary).toEqual({
      averageBookingValue: 45_000, // (50k + 30k + 80k + 20k) / 4
      cancelledBookings: 1,
      period: { month: null, year: YEAR },
      totalSpent: 130_000,
      totalTrips: 1,
      upcomingTrips: 2,
    });

    expect(res.body.data.byType).toEqual({
      FLIGHT: { amount: 80_000, count: 1 },
      ROOM: { amount: 30_000, count: 1 },
      TOUR: { amount: 70_000, count: 2 },
    });

    // Zero-filled: 12 buckets for a year window, activity where seeded.
    const monthly = res.body.data.monthlySpend as {
      amount: number;
      bookings: number;
      month: string;
    }[];
    expect(monthly).toHaveLength(12);
    expect(monthly[0]).toEqual({ amount: 0, bookings: 0, month: '2026-01' });
    expect(monthly[1]).toEqual({
      amount: 50_000,
      bookings: 1,
      month: '2026-02',
    });
    expect(monthly[2]).toEqual({ amount: 0, bookings: 1, month: '2026-03' });
    expect(monthly[4]).toEqual({
      amount: 80_000,
      bookings: 2,
      month: '2026-05',
    });

    // Last-5 DTOs, own rows only.
    const recent = res.body.data.recentBookings as {
      customerId: number;
      type: string;
    }[];
    expect(recent).toHaveLength(4);
    expect(recent.every((b) => b.customerId === customer.id)).toBe(true);
  });

  it('honours the period window (single month)', async () => {
    const customer = await seedCustomerScenario();

    const res = await authedApi(customer).get(
      `/api/v1/reports/me?year=${YEAR}&month=2`,
    );

    expect(res.status).toBe(200);
    expect(res.body.data.summary.totalTrips).toBe(1);
    expect(res.body.data.summary.totalSpent).toBe(50_000);
    expect(res.body.data.summary.upcomingTrips).toBe(0);
    expect(res.body.data.monthlySpend).toHaveLength(1);
  });

  it('is customer-only: staff get 403', async () => {
    const admin = await createAdmin();
    const res = await authedApi(admin).get('/api/v1/reports/me');
    expect(res.status).toBe(403);
  });
});

const seedAgentScenario = async () => {
  const agent = await createAgent();
  const rival = await createAgent();
  const [c1, c2] = await Promise.all([createCustomer(), createCustomer()]);
  const [t1, t2, t3, t4] = await Promise.all([
    createTour(),
    createTour(),
    createTour(),
    createTour(),
  ]);

  // Recorded + paid, Mar.
  const paid = await prisma.booking.create({
    data: {
      bookingDate: new Date('2026-03-15T12:00:00Z'),
      createdByUserId: agent.id,
      customerId: c1.id,
      status: BookingStatus.CONFIRMED,
      totalPrice: 40_000,
      tourId: t1.id,
    },
  });
  await prisma.payment.create({
    data: {
      amount: 40_000,
      bookingId: paid.id,
      customerId: c1.id,
      paymentDate: new Date('2026-03-16T12:00:00Z'),
      paymentMethod: PaymentMethod.MOBILE_MONEY,
      status: PaymentStatus.COMPLETED,
    },
  });
  // Recorded, still PENDING, Mar + Jun — the pipeline value.
  await prisma.booking.create({
    data: {
      bookingDate: new Date('2026-03-20T12:00:00Z'),
      createdByUserId: agent.id,
      customerId: c2.id,
      status: BookingStatus.PENDING,
      totalPrice: 25_000,
      tourId: t2.id,
    },
  });
  await prisma.booking.create({
    data: {
      bookingDate: new Date('2026-06-10T12:00:00Z'),
      createdByUserId: agent.id,
      customerId: c1.id,
      status: BookingStatus.PENDING,
      totalPrice: 10_000,
      tourId: t3.id,
    },
  });
  // A rival agent's booking must not count.
  await prisma.booking.create({
    data: {
      bookingDate: new Date('2026-03-15T12:00:00Z'),
      createdByUserId: rival.id,
      customerId: c2.id,
      status: BookingStatus.PENDING,
      totalPrice: 777_777,
      tourId: t4.id,
    },
  });

  return { agent, rival };
};

describe('GET /api/v1/reports/agent-activity', () => {
  it('aggregates the acting agent with exact numbers', async () => {
    const { agent } = await seedAgentScenario();

    const res = await authedApi(agent).get(
      `/api/v1/reports/agent-activity?year=${YEAR}`,
    );

    expect(res.status).toBe(200);
    expect(res.body.data.summary).toEqual({
      bookingsRecorded: 3,
      customersServed: 2,
      pendingFromRecorded: 35_000,
      period: { month: null, year: YEAR },
      revenueFromRecorded: 40_000,
    });

    const monthly = res.body.data.monthly as {
      bookings: number;
      month: string;
      revenue: number;
    }[];
    expect(monthly).toHaveLength(12);
    expect(monthly[2]).toEqual({
      bookings: 2,
      month: '2026-03',
      revenue: 40_000,
    });
    expect(monthly[5]).toEqual({ bookings: 1, month: '2026-06', revenue: 0 });

    expect(res.body.data.recentBookings).toHaveLength(3);
  });

  it('pins agents to themselves (?userId= is refused) but allows the ADMIN override', async () => {
    const { agent, rival } = await seedAgentScenario();
    const admin = await createAdmin();

    const refused = await authedApi(agent).get(
      `/api/v1/reports/agent-activity?userId=${rival.id}`,
    );
    expect(refused.status).toBe(401);
    expect(refused.body.message).toBe('You can only view your own activity');

    const overridden = await authedApi(admin).get(
      `/api/v1/reports/agent-activity?year=${YEAR}&userId=${agent.id}`,
    );
    expect(overridden.status).toBe(200);
    expect(overridden.body.data.summary.bookingsRecorded).toBe(3);

    // Without the override an admin sees their own (empty) activity.
    const own = await authedApi(admin).get(
      `/api/v1/reports/agent-activity?year=${YEAR}`,
    );
    expect(own.body.data.summary.bookingsRecorded).toBe(0);
  });

  it('is staff-only: customers get 403', async () => {
    const customer = await createCustomer();
    const res = await authedApi(customer).get(
      '/api/v1/reports/agent-activity',
    );
    expect(res.status).toBe(403);
  });

  it('keeps the admin dashboards ADMIN-only (agents still 403)', async () => {
    const agent = await createAgent();
    const res = await authedApi(agent).get(
      '/api/v1/reports/bookings/monthly-summary',
    );
    expect(res.status).toBe(403);
  });
});
