// test/integration/booking-cancel.test.ts
//
// Customer self-cancellation (POST /bookings/:id/cancel): PENDING bookings
// cancel outright with counters restored; CONFIRMED bookings with a COMPLETED
// payment cancel AND park the money on REFUND_REQUESTED for the admin refund
// endpoint (which must accept it); started trips and terminal statuses are
// refused; customers may only cancel their own bookings while staff may
// cancel any. Also pins that the payments list filter accepts the new
// REFUND_REQUESTED enum value (the zod schema derives from PaymentStatus).
import { describe, expect, it, vi } from 'vitest';

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
  createTour,
} from '../helpers/factories.js';

// Refunds now go through the Paystack refund API; fake it so this suite stays
// off the network and exercises only the flow it covers.
vi.mock('#lib/paystack.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('#lib/paystack.js')>();
  return {
    ...actual,
    refundPaystackTransaction: vi.fn(() =>
      Promise.resolve({ amount: null, id: 1, status: 'pending' }),
    ),
  };
});


/** Books a tour through the API so availability counters really move. */
const bookTour = async (
  customer: { id: number },
  tourId: number,
  numberOfGuests = 2,
) => {
  const res = await authedApi(customer).post('/api/v1/bookings').send({
    customerId: customer.id,
    numberOfGuests,
    totalPrice: 0,
    tourId,
  });
  expect(res.status).toBe(201);
  return res.body.data as { id: number; totalPrice: number };
};

/** Marks a booking paid-and-confirmed the way the webhook flow would. */
const markPaidAndConfirmed = async (
  bookingId: number,
  customerId: number,
  amount: number,
) => {
  const payment = await prisma.payment.create({
    data: {
      amount,
      bookingId,
      customerId,
      paymentDate: new Date(),
      paymentMethod: PaymentMethod.CREDIT_CARD,
      status: PaymentStatus.COMPLETED,
      transactionReference: `booking_${String(bookingId)}_test_ref`,
    },
  });
  await prisma.booking.update({
    data: { status: BookingStatus.CONFIRMED },
    where: { id: bookingId },
  });
  return payment;
};

describe('POST /api/v1/bookings/:id/cancel', () => {
  it('cancels a PENDING booking outright and restores the tour counters', async () => {
    const customer = await createCustomer();
    const tour = await createTour({ maxGuests: 10 });
    const booking = await bookTour(customer, tour.id, 2);

    const before = await prisma.tour.findUniqueOrThrow({
      where: { id: tour.id },
    });
    expect(before.guestsBooked).toBe(2);

    const res = await authedApi(customer).post(
      `/api/v1/bookings/${String(booking.id)}/cancel`,
    );

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Booking cancelled successfully');
    expect(res.body.data.refundRequested).toBe(false);
    expect(res.body.data.status).toBe('CANCELLED');

    const after = await prisma.tour.findUniqueOrThrow({
      where: { id: tour.id },
    });
    expect(after.guestsBooked).toBe(0);
  });

  it('restores flight seats when a PENDING flight booking is cancelled', async () => {
    const customer = await createCustomer();
    const flight = await createFlight({ capacity: 50 });

    const res = await authedApi(customer).post('/api/v1/bookings').send({
      customerId: customer.id,
      flightId: flight.id,
      numberOfGuests: 3,
      totalPrice: 0,
    });
    expect(res.status).toBe(201);

    const cancel = await authedApi(customer).post(
      `/api/v1/bookings/${String(res.body.data.id)}/cancel`,
    );
    expect(cancel.status).toBe(200);

    const after = await prisma.flight.findUniqueOrThrow({
      where: { id: flight.id },
    });
    expect(after.seatsAvailable).toBe(50);
  });

  it('moves a COMPLETED payment to REFUND_REQUESTED when a paid CONFIRMED booking is cancelled', async () => {
    const customer = await createCustomer();
    const tour = await createTour({ maxGuests: 10, price: 50000 });
    const booking = await bookTour(customer, tour.id, 2);
    const payment = await markPaidAndConfirmed(
      booking.id,
      customer.id,
      booking.totalPrice,
    );

    const res = await authedApi(customer).post(
      `/api/v1/bookings/${String(booking.id)}/cancel`,
    );

    expect(res.status).toBe(200);
    expect(res.body.message).toBe(
      'Booking cancelled — a refund request has been sent to our team',
    );
    expect(res.body.data.refundRequested).toBe(true);
    expect(res.body.data.status).toBe('CANCELLED');

    const paymentRow = await prisma.payment.findUniqueOrThrow({
      where: { id: payment.id },
    });
    expect(paymentRow.status).toBe('REFUND_REQUESTED');

    // Counters restored even on the paid path.
    const after = await prisma.tour.findUniqueOrThrow({
      where: { id: tour.id },
    });
    expect(after.guestsBooked).toBe(0);
  });

  it('lets an admin action a REFUND_REQUESTED payment via the refund endpoint', async () => {
    const customer = await createCustomer();
    const admin = await createAdmin();
    const tour = await createTour({ maxGuests: 10, price: 50000 });
    const booking = await bookTour(customer, tour.id, 1);
    const payment = await markPaidAndConfirmed(
      booking.id,
      customer.id,
      booking.totalPrice,
    );

    await authedApi(customer).post(
      `/api/v1/bookings/${String(booking.id)}/cancel`,
    );

    const res = await authedApi(admin)
      .patch(`/api/v1/payments/${String(payment.id)}/refund`)
      .send({ reason: 'Customer self-cancelled' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('REFUNDED');
    expect(res.body.data.refundAmount).toBe(booking.totalPrice);

    const paymentRow = await prisma.payment.findUniqueOrThrow({
      where: { id: payment.id },
    });
    expect(paymentRow.status).toBe('REFUNDED');
  });

  it('lists REFUND_REQUESTED payments through the existing status filter', async () => {
    const customer = await createCustomer();
    const admin = await createAdmin();
    const tour = await createTour({ maxGuests: 10 });
    const booking = await bookTour(customer, tour.id, 1);
    await markPaidAndConfirmed(booking.id, customer.id, booking.totalPrice);
    await authedApi(customer).post(
      `/api/v1/bookings/${String(booking.id)}/cancel`,
    );

    const res = await authedApi(admin).get(
      '/api/v1/payments?status=REFUND_REQUESTED',
    );

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].status).toBe('REFUND_REQUESTED');
    expect(res.body.data[0].bookingId).toBe(booking.id);
  });

  it('refuses to cancel when the trip has already started', async () => {
    const customer = await createCustomer();
    const started = await createTour({
      startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
    });
    // Seeded directly: the create API refuses past-dated bookings.
    const booking = await prisma.booking.create({
      data: {
        customerId: customer.id,
        numberOfGuests: 1,
        totalPrice: 50000,
        tourId: started.id,
      },
    });

    const res = await authedApi(customer).post(
      `/api/v1/bookings/${String(booking.id)}/cancel`,
    );

    expect(res.status).toBe(400);
    expect(res.body.message).toBe(
      'This booking can no longer be cancelled because the trip has already started',
    );
  });

  it('refuses terminal statuses (already CANCELLED / COMPLETED)', async () => {
    const customer = await createCustomer();
    const tour = await createTour();
    const cancelled = await prisma.booking.create({
      data: {
        customerId: customer.id,
        status: BookingStatus.CANCELLED,
        totalPrice: 50000,
        tourId: tour.id,
      },
    });

    const res = await authedApi(customer).post(
      `/api/v1/bookings/${String(cancelled.id)}/cancel`,
    );
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('This booking is already cancelled');

    const tour2 = await createTour();
    const completed = await prisma.booking.create({
      data: {
        customerId: customer.id,
        status: BookingStatus.COMPLETED,
        totalPrice: 50000,
        tourId: tour2.id,
      },
    });

    const done = await authedApi(customer).post(
      `/api/v1/bookings/${String(completed.id)}/cancel`,
    );
    expect(done.status).toBe(400);
    expect(done.body.message).toBe('Completed bookings cannot be cancelled');
  });

  it("blocks a customer from cancelling another customer's booking", async () => {
    const owner = await createCustomer();
    const intruder = await createCustomer();
    const tour = await createTour();
    const booking = await bookTour(owner, tour.id, 1);

    const res = await authedApi(intruder).post(
      `/api/v1/bookings/${String(booking.id)}/cancel`,
    );

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('You can only cancel your own bookings');
  });

  it("lets staff cancel any customer's booking", async () => {
    const customer = await createCustomer();
    const agent = await createAgent();
    const tour = await createTour({ maxGuests: 10 });
    const booking = await bookTour(customer, tour.id, 2);

    const res = await authedApi(agent).post(
      `/api/v1/bookings/${String(booking.id)}/cancel`,
    );

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('CANCELLED');

    const after = await prisma.tour.findUniqueOrThrow({
      where: { id: tour.id },
    });
    expect(after.guestsBooked).toBe(0);
  });

  it('404s a missing booking', async () => {
    const customer = await createCustomer();
    const res = await authedApi(customer).post('/api/v1/bookings/99999/cancel');
    expect(res.status).toBe(404);
  });
});
