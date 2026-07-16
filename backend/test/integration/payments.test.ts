// test/integration/payments.test.ts
//
// Payments domain coverage, pinned against the service-layer refactor: the
// Paystack initialize flow (fresh + resumed sessions, ownership and method
// guards), the webhook (REAL raw-body HMAC signature verification against
// PAYSTACK_SECRET_KEY, charge.success completion, amount reconciliation),
// the redirect callback, customer scoping on reads, and the manual status /
// refund / delete admin flows.
//
// The Paystack HTTP client is faked below (khadys pattern): initialize
// echoes an authorization_url + reference and records the amount/metadata it
// was called with; verify replays them keyed by reference, so the service's
// amount-reconciliation check behaves exactly like real Paystack. The
// signature helper `verifyPaystackSignature` stays REAL — webhook tests sign
// payloads with the vitest secret for real.
import crypto from 'crypto';
import { describe, expect, it, vi } from 'vitest';

import prisma from '#config/prismaClient.js';

import { api, authedApi } from '../helpers/auth.js';
import {
  createAdmin,
  createCustomer,
  createTour,
} from '../helpers/factories.js';

vi.mock('#lib/paystack.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('#lib/paystack.js')>();
  const charged = new Map<
    string,
    { amount: number; metadata?: Record<string, unknown> }
  >();
  let seq = 0;
  return {
    ...actual,
    initializePaystackTransaction: vi.fn(
      (params: {
        amount: number;
        metadata?: Record<string, unknown>;
        reference?: string;
      }) => {
        seq += 1;
        const reference = params.reference ?? `ps_ref_${String(seq)}`;
        charged.set(reference, {
          amount: params.amount,
          metadata: params.metadata,
        });
        return Promise.resolve({
          access_code: 'acc_test',
          authorization_url: `https://paystack.test/pay/${reference}`,
          reference,
        });
      },
    ),
    refundPaystackTransaction: vi.fn(() =>
      Promise.resolve({ id: 1, status: 'pending' }),
    ),
    verifyPaystackTransaction: vi.fn((reference: string) => {
      const entry = charged.get(reference);
      return Promise.resolve({
        amount: entry?.amount ?? 0,
        currency: 'GHS',
        metadata: entry?.metadata,
        paid_at: '2026-01-01T00:00:00.000Z',
        reference,
        status: 'success',
      });
    }),
  };
});

/** Signs a webhook payload the way Paystack does (vitest env secret). */
const signWebhook = (payload: string): string =>
  crypto.createHmac('sha512', 'sk_test_vitest').update(payload).digest('hex');

/** POSTs a webhook event with an HMAC computed over the exact raw bytes. */
const postWebhook = (event: Record<string, unknown>, signature?: string) => {
  const body = JSON.stringify(event);
  return api()
    .post('/api/v1/payments/webhook')
    .set('Content-Type', 'application/json')
    .set('x-paystack-signature', signature ?? signWebhook(body))
    .send(body);
};

/** A PENDING tour booking to pay for. */
const createPendingBooking = async (customerId: number, totalPrice = 500) => {
  const tour = await createTour({ price: totalPrice });
  return prisma.booking.create({
    data: {
      customerId,
      numberOfGuests: 1,
      totalPrice,
      tourId: tour.id,
    },
  });
};

/** Initializes a payment through the API; returns the response data block. */
const initPayment = async (
  user: { id: number; role?: 'ADMIN' | 'AGENT' | 'CUSTOMER' },
  bookingId: number,
) => {
  const res = await authedApi(user)
    .post('/api/v1/payments')
    .send({ bookingId, paymentMethod: 'CREDIT_CARD' });
  expect(res.status).toBe(200);
  return res.body.data as {
    authorization_url: string;
    paymentId: number;
    transactionReference: string;
  };
};

describe('POST /api/v1/payments', () => {
  it('initializes a Paystack transaction and creates a PENDING payment row', async () => {
    const customer = await createCustomer();
    const booking = await createPendingBooking(customer.id, 750);

    const res = await authedApi(customer)
      .post('/api/v1/payments')
      .send({ bookingId: booking.id, paymentMethod: 'CREDIT_CARD' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Payment initialized successfully');
    expect(res.body.data.transactionReference).toMatch(
      new RegExp(`^booking_${String(booking.id)}_`),
    );
    expect(res.body.data.authorization_url).toBe(
      `https://paystack.test/pay/${res.body.data.transactionReference}`,
    );

    const payment = await prisma.payment.findUnique({
      where: { id: res.body.data.paymentId },
    });
    expect(payment?.status).toBe('PENDING');
    expect(payment?.amount).toBe(750);
    expect(payment?.bookingId).toBe(booking.id);
    expect(payment?.customerId).toBe(customer.id);
  });

  it('resumes an existing pending payment with its original reference', async () => {
    const customer = await createCustomer();
    const booking = await createPendingBooking(customer.id);
    const first = await initPayment(customer, booking.id);

    const res = await authedApi(customer)
      .post('/api/v1/payments')
      .send({ bookingId: booking.id, paymentMethod: 'MOBILE_MONEY' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Payment session resumed');
    expect(res.body.data.paymentId).toBe(first.paymentId);
    expect(res.body.data.transactionReference).toBe(
      first.transactionReference,
    );
    expect(await prisma.payment.count()).toBe(1);
  });

  it("blocks a customer from paying for another user's booking", async () => {
    const customerA = await createCustomer();
    const customerB = await createCustomer();
    const booking = await createPendingBooking(customerA.id);

    const res = await authedApi(customerB)
      .post('/api/v1/payments')
      .send({ bookingId: booking.id, paymentMethod: 'CREDIT_CARD' });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('You can only pay for your own bookings');
  });

  it('rejects an invalid payment method with the legacy 400', async () => {
    const customer = await createCustomer();
    const booking = await createPendingBooking(customer.id);

    const res = await authedApi(customer)
      .post('/api/v1/payments')
      .send({ bookingId: booking.id, paymentMethod: 'CASH' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Invalid payment method');
  });
});

describe('POST /api/v1/payments/webhook', () => {
  it('completes the payment and confirms the booking on a validly signed charge.success', async () => {
    const customer = await createCustomer();
    const booking = await createPendingBooking(customer.id, 500);
    const { transactionReference } = await initPayment(customer, booking.id);

    const res = await postWebhook({
      data: {
        metadata: { bookingId: booking.id },
        reference: transactionReference,
      },
      event: 'charge.success',
    });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Payment verified and booking confirmed');

    const payment = await prisma.payment.findUnique({
      where: { transactionReference },
    });
    expect(payment?.status).toBe('COMPLETED');
    expect(payment?.paymentDate).not.toBeNull();

    const confirmed = await prisma.booking.findUnique({
      where: { id: booking.id },
    });
    expect(confirmed?.status).toBe('CONFIRMED');
  });

  it('rejects a webhook whose signature does not match the raw body', async () => {
    const customer = await createCustomer();
    const booking = await createPendingBooking(customer.id);
    const { transactionReference } = await initPayment(customer, booking.id);

    const res = await postWebhook(
      {
        data: {
          metadata: { bookingId: booking.id },
          reference: transactionReference,
        },
        event: 'charge.success',
      },
      signWebhook('{"tampered":true}'),
    );

    expect(res.status).toBe(400);
    expect(res.text).toBe('Invalid signature');

    const payment = await prisma.payment.findUnique({
      where: { transactionReference },
    });
    expect(payment?.status).toBe('PENDING');
  });

  it('marks the payment FAILED and 500s when the verified amount mismatches the booking total', async () => {
    const customer = await createCustomer();
    const booking = await createPendingBooking(customer.id, 500);
    const { transactionReference } = await initPayment(customer, booking.id);

    // Paystack will report the initialized amount (500); shift the booking
    // total so reconciliation fails.
    await prisma.booking.update({
      data: { totalPrice: 900 },
      where: { id: booking.id },
    });

    const res = await postWebhook({
      data: {
        metadata: { bookingId: booking.id },
        reference: transactionReference,
      },
      event: 'charge.success',
    });

    expect(res.status).toBe(500);
    expect(res.body.message).toBe(
      'Payment amount does not match booking total price',
    );

    const payment = await prisma.payment.findUnique({
      where: { transactionReference },
    });
    expect(payment?.status).toBe('FAILED');
  });

  it('acknowledges non-charge.success events without touching anything', async () => {
    const res = await postWebhook({
      data: { reference: 'ps_ref_unknown' },
      event: 'charge.dispute.create',
    });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Event received');
  });
});

describe('GET /api/v1/payments/callback', () => {
  it('verifies the transaction, completes the payment and confirms the booking', async () => {
    const customer = await createCustomer();
    const booking = await createPendingBooking(customer.id, 500);
    const { transactionReference } = await initPayment(customer, booking.id);

    const res = await authedApi(customer).get(
      `/api/v1/payments/callback?reference=${transactionReference}`,
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Payment verified successfully');
    expect(res.body.data).toEqual({
      amount: 500,
      bookingId: booking.id,
      paymentStatus: 'COMPLETED',
      reference: transactionReference,
    });

    const payment = await prisma.payment.findUnique({
      where: { transactionReference },
    });
    expect(payment?.status).toBe('COMPLETED');

    const confirmed = await prisma.booking.findUnique({
      where: { id: booking.id },
    });
    expect(confirmed?.status).toBe('CONFIRMED');
  });

  it('rejects a callback without a reference', async () => {
    const customer = await createCustomer();

    const res = await authedApi(customer).get('/api/v1/payments/callback');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      message: 'No reference provided',
      success: false,
    });
  });
});

describe('GET /api/v1/payments (scoping)', () => {
  it('scopes customers to their own payments while admins see all', async () => {
    const customerA = await createCustomer();
    const customerB = await createCustomer();
    const admin = await createAdmin();
    const bookingA = await createPendingBooking(customerA.id);
    const bookingB = await createPendingBooking(customerB.id);
    await initPayment(customerA, bookingA.id);
    await initPayment(customerB, bookingB.id);

    const asCustomer = await authedApi(customerA).get('/api/v1/payments');
    expect(asCustomer.status).toBe(200);
    expect(asCustomer.body.data.length).toBe(1);
    expect(asCustomer.body.data[0].customerId).toBe(customerA.id);
    expect(asCustomer.body.data[0].bookedItem.type).toBe('TOUR');
    expect(asCustomer.body.meta.total).toBe(1);

    const asAdmin = await authedApi(admin).get('/api/v1/payments');
    expect(asAdmin.status).toBe(200);
    expect(asAdmin.body.meta.total).toBe(2);
  });

  it("blocks a customer from reading another user's payment by id", async () => {
    const customerA = await createCustomer();
    const customerB = await createCustomer();
    const booking = await createPendingBooking(customerA.id);
    const { paymentId } = await initPayment(customerA, booking.id);

    const res = await authedApi(customerB).get(
      `/api/v1/payments/${String(paymentId)}`,
    );

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('You can only view your own payments');
  });

  it("blocks a customer from listing another user's payments", async () => {
    const customerA = await createCustomer();
    const customerB = await createCustomer();

    const res = await authedApi(customerA).get(
      `/api/v1/payments/customer/${String(customerB.id)}`,
    );

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('You can only view your own payments');
  });
});

describe('PATCH /api/v1/payments/:id (manual status update)', () => {
  it('lets an admin complete a payment manually and confirms the booking', async () => {
    const customer = await createCustomer();
    const admin = await createAdmin();
    const booking = await createPendingBooking(customer.id);
    const { paymentId } = await initPayment(customer, booking.id);

    const res = await authedApi(admin)
      .patch(`/api/v1/payments/${String(paymentId)}`)
      .send({ status: 'COMPLETED' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('COMPLETED');
    expect(res.body.data.bookingStatus).toBe('CONFIRMED');

    const confirmed = await prisma.booking.findUnique({
      where: { id: booking.id },
    });
    expect(confirmed?.status).toBe('CONFIRMED');
  });

  it('blocks non-admins from updating payment status', async () => {
    const customer = await createCustomer();
    const booking = await createPendingBooking(customer.id);
    const { paymentId } = await initPayment(customer, booking.id);

    const res = await authedApi(customer)
      .patch(`/api/v1/payments/${String(paymentId)}`)
      .send({ status: 'COMPLETED' });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe(
      'Only administrators can update payment status',
    );
  });

  it('refuses to move a completed payment back to pending', async () => {
    const customer = await createCustomer();
    const admin = await createAdmin();
    const booking = await createPendingBooking(customer.id);
    const { paymentId } = await initPayment(customer, booking.id);
    await authedApi(admin)
      .patch(`/api/v1/payments/${String(paymentId)}`)
      .send({ status: 'COMPLETED' });

    const res = await authedApi(admin)
      .patch(`/api/v1/payments/${String(paymentId)}`)
      .send({ status: 'PENDING' });

    expect(res.status).toBe(409);
    expect(res.body.message).toBe(
      'Cannot change completed payment back to pending',
    );
  });
});

describe('PATCH /api/v1/payments/:id/refund', () => {
  it('refunds a completed payment and cancels the booking', async () => {
    const customer = await createCustomer();
    const admin = await createAdmin();
    const booking = await createPendingBooking(customer.id, 500);
    const { paymentId, transactionReference } = await initPayment(
      customer,
      booking.id,
    );
    await postWebhook({
      data: {
        metadata: { bookingId: booking.id },
        reference: transactionReference,
      },
      event: 'charge.success',
    });

    const res = await authedApi(admin)
      .patch(`/api/v1/payments/${String(paymentId)}/refund`)
      .send({ reason: 'Customer request' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('REFUNDED');
    expect(res.body.data.bookingStatus).toBe('CANCELLED');
    expect(res.body.data.refundAmount).toBe(500);
    expect(res.body.data.reason).toBe('Customer request');

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
    });
    expect(payment?.status).toBe('REFUNDED');

    const cancelled = await prisma.booking.findUnique({
      where: { id: booking.id },
    });
    expect(cancelled?.status).toBe('CANCELLED');
  });

  it('refuses to refund a payment that is not completed', async () => {
    const customer = await createCustomer();
    const admin = await createAdmin();
    const booking = await createPendingBooking(customer.id);
    const { paymentId } = await initPayment(customer, booking.id);

    const res = await authedApi(admin)
      .patch(`/api/v1/payments/${String(paymentId)}/refund`)
      .send({});

    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Only completed payments can be refunded');
  });

  it('blocks non-admins from refunding', async () => {
    const customer = await createCustomer();
    const booking = await createPendingBooking(customer.id);
    const { paymentId } = await initPayment(customer, booking.id);

    const res = await authedApi(customer)
      .patch(`/api/v1/payments/${String(paymentId)}/refund`)
      .send({ reason: 'please' });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Only administrators can refund payments');
  });
});

describe('DELETE /api/v1/payments/:id', () => {
  it('lets an admin delete a pending payment and reverts the booking to PENDING', async () => {
    const customer = await createCustomer();
    const admin = await createAdmin();
    const booking = await createPendingBooking(customer.id);
    const { paymentId } = await initPayment(customer, booking.id);

    const res = await authedApi(admin).delete(
      `/api/v1/payments/${String(paymentId)}`,
    );

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      bookingId: booking.id,
      paymentId,
    });
    // Soft delete: hidden from scoped reads, but the row survives with a
    // deletedAt tombstone (findUnique is deliberately unscoped).
    expect(
      await prisma.payment.findFirst({ where: { id: paymentId } }),
    ).toBeNull();
    const tombstone = await prisma.payment.findUnique({
      where: { id: paymentId },
    });
    expect(tombstone?.deletedAt).toBeInstanceOf(Date);

    const reverted = await prisma.booking.findUnique({
      where: { id: booking.id },
    });
    expect(reverted?.status).toBe('PENDING');
  });

  it('protects completed payments from deletion', async () => {
    const customer = await createCustomer();
    const admin = await createAdmin();
    const booking = await createPendingBooking(customer.id);
    const { paymentId, transactionReference } = await initPayment(
      customer,
      booking.id,
    );
    await postWebhook({
      data: {
        metadata: { bookingId: booking.id },
        reference: transactionReference,
      },
      event: 'charge.success',
    });

    const res = await authedApi(admin).delete(
      `/api/v1/payments/${String(paymentId)}`,
    );

    expect(res.status).toBe(409);
    expect(res.body.message).toBe(
      'Cannot delete completed payments. Consider refunding instead.',
    );
  });
});
