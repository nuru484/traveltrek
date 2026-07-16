// test/integration/notifications.test.ts
//
// Transactional notification matrix (mail/SMS libs are mocked in
// test/setup.ts; messages are read back via the helpers):
//
//   booking created            → email (or SMS when the customer has no email)
//   booking confirmed          → email/SMS on the staff status transition
//   booking cancelled          → self-cancel variant (+ refund note when paid)
//   deadline-expiry sweep      → deadline variant, via the service function
//                                the worker calls (cancelExpiredBookings)
//   payment receipt            → manual/cash completion (webhook path shares
//                                the same notifier)
//   refund processed           → admin refund
//
// Every dispatch is fire-and-forget: a request must succeed even though the
// sends resolve asynchronously (the mocks resolve immediately, so reading the
// outbox right after the response is deterministic).
import { beforeEach, describe, expect, it } from 'vitest';

import prisma, {
  BookingStatus,
  PaymentMethod,
  PaymentStatus,
} from '#config/prismaClient.js';
import { cancelExpiredBookings } from '#services/booking.service.js';

import { authedApi } from '../helpers/auth.js';
import {
  createAdmin,
  createCustomer,
  createTour,
} from '../helpers/factories.js';
import {
  clearMessages,
  lastEmailTo,
  lastSmsTo,
  sentEmails,
  sentSms,
} from '../helpers/messages.js';

const bookTour = async (
  customer: { id: number },
  tourId: number,
  numberOfGuests = 1,
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

const createCompletedPayment = (
  bookingId: number,
  customerId: number,
  amount: number,
) =>
  prisma.payment.create({
    data: {
      amount,
      bookingId,
      customerId,
      paymentDate: new Date(),
      paymentMethod: PaymentMethod.MOBILE_MONEY,
      status: PaymentStatus.COMPLETED,
      transactionReference: `ref_${String(bookingId)}`,
    },
  });

// Mock call history persists across tests in a file — start each from a
// clean outbox so the channel/count assertions are exact.
beforeEach(() => {
  clearMessages();
});

describe('booking notifications', () => {
  it('emails a pending-booking notice (with the payment deadline) on create', async () => {
    const customer = await createCustomer();
    const tour = await createTour({ name: 'Kakum Canopy Walk', price: 50000 });
    const booking = await bookTour(customer, tour.id, 2);

    const email = lastEmailTo(customer.email ?? '');
    expect(email).toBeDefined();
    expect(email?.subject).toBe(
      `Booking #${booking.id} received — payment pending`,
    );
    expect(email?.text).toContain(`Hi ${customer.name}`);
    expect(email?.text).toContain('Kakum Canopy Walk');
    // 2 guests × GH₵ 500.00 = GHS 1,000.00, rendered from pesewas.
    expect(email?.text).toContain('Total due: GHS 1,000.00');
    expect(email?.text).toContain('Please complete payment by');
    // Email-first channel rule: no SMS when an email is on file.
    expect(sentSms()).toHaveLength(0);
  });

  it('falls back to SMS when the customer has no email', async () => {
    const customer = await createCustomer({
      email: undefined,
      phone: '233550009911',
    });
    // Phone-only signup really has no email.
    await prisma.customer.update({
      data: { email: null },
      where: { id: customer.id },
    });

    const tour = await createTour({ name: 'Mole Safari', price: 20000 });
    const booking = await bookTour(customer, tour.id, 1);

    const sms = lastSmsTo('233550009911');
    expect(sms).toBeDefined();
    expect(sms?.message).toContain(`booking #${booking.id}`);
    expect(sms?.message).toContain('Mole Safari');
    expect(sms?.message).toContain('GHS 200.00');
    expect(sentEmails()).toHaveLength(0);
  });

  it('sends the confirmed notice on the staff CONFIRMED transition', async () => {
    const customer = await createCustomer();
    const admin = await createAdmin();
    const tour = await createTour({ name: 'Cape Coast Heritage' });
    const booking = await bookTour(customer, tour.id, 1);
    await createCompletedPayment(booking.id, customer.id, booking.totalPrice);
    clearMessages();

    const res = await authedApi(admin)
      .put(`/api/v1/bookings/${String(booking.id)}`)
      .send({ status: 'CONFIRMED' });
    expect(res.status).toBe(200);

    const email = lastEmailTo(customer.email ?? '');
    expect(email?.subject).toBe(`Booking #${booking.id} confirmed`);
    expect(email?.text).toContain('Cape Coast Heritage');
    expect(email?.text).toContain('is now confirmed');
  });

  it('sends the cancelled notice with a refund note on a paid self-cancel', async () => {
    const customer = await createCustomer();
    const tour = await createTour({ name: 'Volta Lake Cruise', price: 30000 });
    const booking = await bookTour(customer, tour.id, 1);
    await createCompletedPayment(booking.id, customer.id, booking.totalPrice);
    await prisma.booking.update({
      data: { status: BookingStatus.CONFIRMED },
      where: { id: booking.id },
    });
    clearMessages();

    const res = await authedApi(customer).post(
      `/api/v1/bookings/${String(booking.id)}/cancel`,
    );
    expect(res.status).toBe(200);

    const email = lastEmailTo(customer.email ?? '');
    expect(email?.subject).toBe(`Booking #${booking.id} cancelled`);
    expect(email?.text).toContain('has been cancelled');
    expect(email?.text).toContain(
      'Your payment of GHS 300.00 is being processed for a refund',
    );
  });

  it('sends the plain cancelled notice (no refund note) on an unpaid self-cancel', async () => {
    const customer = await createCustomer();
    const tour = await createTour({ name: 'Aburi Gardens' });
    const booking = await bookTour(customer, tour.id, 1);
    clearMessages();

    const res = await authedApi(customer).post(
      `/api/v1/bookings/${String(booking.id)}/cancel`,
    );
    expect(res.status).toBe(200);

    const email = lastEmailTo(customer.email ?? '');
    expect(email?.subject).toBe(`Booking #${booking.id} cancelled`);
    expect(email?.text).not.toContain('refund');
  });

  it('sends the deadline-expired variant from the sweep the worker runs', async () => {
    const customer = await createCustomer();
    const tour = await createTour({ maxGuests: 10, name: 'Elmina Castle' });
    const booking = await bookTour(customer, tour.id, 2);
    await prisma.booking.update({
      data: { paymentDeadline: new Date(Date.now() - 60_000) },
      where: { id: booking.id },
    });
    clearMessages();

    const summary = await cancelExpiredBookings();
    expect(summary).toEqual({ cancelledCount: 1, failureCount: 0 });

    const row = await prisma.booking.findUniqueOrThrow({
      where: { id: booking.id },
    });
    expect(row.status).toBe('CANCELLED');

    // Counters restored by the sweep too.
    const after = await prisma.tour.findUniqueOrThrow({
      where: { id: tour.id },
    });
    expect(after.guestsBooked).toBe(0);

    const email = lastEmailTo(customer.email ?? '');
    expect(email?.subject).toBe(`Booking #${booking.id} cancelled`);
    expect(email?.text).toContain(
      'cancelled because the payment deadline passed',
    );
  });
});

describe('payment notifications', () => {
  it('sends a receipt on manual (admin) payment completion', async () => {
    const customer = await createCustomer();
    const admin = await createAdmin();
    const tour = await createTour({ name: 'Kumasi City Tour', price: 40000 });
    const booking = await bookTour(customer, tour.id, 1);
    const payment = await prisma.payment.create({
      data: {
        amount: booking.totalPrice,
        bookingId: booking.id,
        customerId: customer.id,
        paymentMethod: PaymentMethod.MOBILE_MONEY,
        status: PaymentStatus.PENDING,
        transactionReference: `manual_${String(booking.id)}`,
      },
    });
    clearMessages();

    const res = await authedApi(admin)
      .patch(`/api/v1/payments/${String(payment.id)}`)
      .send({ status: 'COMPLETED' });
    expect(res.status).toBe(200);

    const email = lastEmailTo(customer.email ?? '');
    expect(email?.subject).toBe(`Payment received for booking #${booking.id}`);
    expect(email?.text).toContain('GHS 400.00');
    expect(email?.text).toContain('Kumasi City Tour');
    expect(email?.text).toContain(`manual_${String(booking.id)}`);
  });

  it('sends a refund-processed notice when an admin refunds', async () => {
    const customer = await createCustomer();
    const admin = await createAdmin();
    const tour = await createTour({ name: 'Wli Waterfalls', price: 25000 });
    const booking = await bookTour(customer, tour.id, 1);
    const payment = await createCompletedPayment(
      booking.id,
      customer.id,
      booking.totalPrice,
    );
    await prisma.booking.update({
      data: { status: BookingStatus.CONFIRMED },
      where: { id: booking.id },
    });
    clearMessages();

    const res = await authedApi(admin)
      .patch(`/api/v1/payments/${String(payment.id)}/refund`)
      .send({ reason: 'Trip cancelled by operator' });
    expect(res.status).toBe(200);

    const email = lastEmailTo(customer.email ?? '');
    expect(email?.subject).toBe(`Refund processed for booking #${booking.id}`);
    expect(email?.text).toContain('GHS 250.00');
    expect(email?.text).toContain('Wli Waterfalls');
  });
});
