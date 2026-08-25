// test/integration/payment-reconciliation.test.ts
//
// The scheduled payment reconciliation sweep, driven directly through the
// service with a fake Paystack client and a fixed clock: settled charges the
// webhook and callback both missed are credited, abandoned ones closed,
// charges that settled after their booking was cancelled are refunded,
// refunds Paystack never received are re-issued, and refunds issued on the
// Paystack dashboard are recorded.
import { describe, expect, it, vi } from 'vitest';

import prisma from '#config/prismaClient.js';
import { fixedClock } from '#lib/clock.js';
import { CustomError } from '#middlewares/error-handler.js';
import { defaultDeps, type PaystackClient } from '#services/deps.js';
import { makePaymentService } from '#services/payment.service.js';
import { REFUND_IN_FLIGHT_GRACE_MS } from '#services/payment/reconcile.service.js';

import { createCustomer, createTour } from '../helpers/factories.js';

const NOW = new Date('2026-08-25T12:00:00.000Z');
const HOUR = 60 * 60 * 1000;

const fakePaystack = (
  overrides: Partial<PaystackClient> = {},
): PaystackClient => ({
  initialize: vi.fn(),
  listRefunds: vi.fn(() => Promise.resolve([])),
  listRefundsSince: vi.fn(() => Promise.resolve([])),
  refund: vi.fn(() =>
    Promise.resolve({ amount: null, id: 77, status: 'pending' }),
  ),
  verify: vi.fn(),
  ...overrides,
});

const serviceWith = (paystack: PaystackClient) =>
  makePaymentService({
    ...defaultDeps,
    clock: fixedClock(NOW),
    notify: { email: vi.fn(), sms: vi.fn() },
    paystack,
  });

/** A booking with a PENDING Paystack payment created `ageMs` ago. */
const pendingCharge = async (input: {
  ageMs: number;
  bookingStatus?: 'CANCELLED' | 'PENDING';
  totalPrice?: number;
}) => {
  const customer = await createCustomer();
  const tour = await createTour({ price: input.totalPrice ?? 500 });
  const booking = await prisma.booking.create({
    data: {
      customerId: customer.id,
      numberOfGuests: 1,
      status: input.bookingStatus ?? 'PENDING',
      totalPrice: input.totalPrice ?? 500,
      tourId: tour.id,
    },
  });
  const payment = await prisma.payment.create({
    data: {
      amount: booking.totalPrice,
      bookingId: booking.id,
      createdAt: new Date(NOW.getTime() - input.ageMs),
      customerId: customer.id,
      paymentMethod: 'CREDIT_CARD',
      status: 'PENDING',
      transactionReference: `ref_${String(booking.id)}`,
    },
  });
  return { booking, payment };
};

const verified = (status: string, amount: number) => ({
  amount,
  currency: 'GHS',
  paid_at: null,
  reference: 'x',
  status,
});

describe('reconcilePayments: unconfirmed charges', () => {
  it('credits a settled charge and confirms its booking', async () => {
    const { booking, payment } = await pendingCharge({ ageMs: HOUR });
    const paystack = fakePaystack({
      verify: vi.fn(() => Promise.resolve(verified('success', 500))),
    });

    const summary = await serviceWith(paystack).reconcilePayments();

    expect(summary.chargesRecovered).toBe(1);
    const row = await prisma.payment.findUnique({ where: { id: payment.id } });
    expect(row?.status).toBe('COMPLETED');
    const confirmed = await prisma.booking.findUnique({
      where: { id: booking.id },
    });
    expect(confirmed?.status).toBe('CONFIRMED');
  });

  it('closes a charge Paystack reports as abandoned', async () => {
    const { payment } = await pendingCharge({ ageMs: HOUR });
    const paystack = fakePaystack({
      verify: vi.fn(() => Promise.resolve(verified('abandoned', 500))),
    });

    const summary = await serviceWith(paystack).reconcilePayments();

    expect(summary.chargesClosed).toBe(1);
    const row = await prisma.payment.findUnique({ where: { id: payment.id } });
    expect(row?.status).toBe('FAILED');
  });

  it('leaves a charge still in flight at Paystack pending', async () => {
    const { payment } = await pendingCharge({ ageMs: HOUR });
    const paystack = fakePaystack({
      verify: vi.fn(() => Promise.resolve(verified('ongoing', 500))),
    });

    await serviceWith(paystack).reconcilePayments();

    const row = await prisma.payment.findUnique({ where: { id: payment.id } });
    expect(row?.status).toBe('PENDING');
  });

  it('does not interrogate a charge younger than the minimum age', async () => {
    await pendingCharge({ ageMs: 2 * 60 * 1000 });
    const paystack = fakePaystack();

    await serviceWith(paystack).reconcilePayments();

    expect(paystack.verify).not.toHaveBeenCalled();
  });

  it('refunds a charge that settled after its booking was cancelled', async () => {
    const { booking, payment } = await pendingCharge({
      ageMs: HOUR,
      bookingStatus: 'CANCELLED',
    });
    const paystack = fakePaystack({
      verify: vi.fn(() => Promise.resolve(verified('success', 500))),
    });

    await serviceWith(paystack).reconcilePayments();

    expect(paystack.refund).toHaveBeenCalledWith({
      amount: 500,
      reference: payment.transactionReference,
    });
    const row = await prisma.payment.findUnique({ where: { id: payment.id } });
    expect(row?.status).toBe('REFUNDED');
    expect(row?.providerRefundId).toBe(77);
    const still = await prisma.booking.findUnique({
      where: { id: booking.id },
    });
    expect(still?.status).toBe('CANCELLED');
  });

  it('marks a settled charge FAILED when its amount does not match the booking', async () => {
    const { payment } = await pendingCharge({ ageMs: HOUR });
    const paystack = fakePaystack({
      verify: vi.fn(() => Promise.resolve(verified('success', 499))),
    });

    await serviceWith(paystack).reconcilePayments();

    const row = await prisma.payment.findUnique({ where: { id: payment.id } });
    expect(row?.status).toBe('FAILED');
  });
});

describe('reconcilePayments: refunds', () => {
  const refundedClaim = async (refundedAgoMs: number) => {
    const { booking, payment } = await pendingCharge({ ageMs: 2 * HOUR });
    await prisma.booking.update({
      data: { status: 'CANCELLED' },
      where: { id: booking.id },
    });
    return prisma.payment.update({
      data: {
        refundedAt: new Date(NOW.getTime() - refundedAgoMs),
        refundReason: 'Customer request',
        status: 'REFUNDED',
      },
      where: { id: payment.id },
    });
  };

  it('re-issues a refund the ledger claimed but Paystack never received', async () => {
    const payment = await refundedClaim(HOUR);
    const paystack = fakePaystack();

    const summary = await serviceWith(paystack).reconcilePayments();

    expect(summary.refundsReissued).toBe(1);
    expect(paystack.refund).toHaveBeenCalledWith({
      amount: payment.amount,
      reference: payment.transactionReference,
    });
    const row = await prisma.payment.findUnique({ where: { id: payment.id } });
    expect(row?.providerRefundId).toBe(77);
  });

  it('leaves a claim alone while it may still be in flight', async () => {
    await refundedClaim(REFUND_IN_FLIGHT_GRACE_MS / 2);
    const paystack = fakePaystack();

    await serviceWith(paystack).reconcilePayments();

    expect(paystack.listRefunds).not.toHaveBeenCalled();
    expect(paystack.refund).not.toHaveBeenCalled();
  });

  it('treats a live refund at Paystack as settled', async () => {
    await refundedClaim(HOUR);
    const paystack = fakePaystack({
      listRefunds: vi.fn(() =>
        Promise.resolve([{ amount: 500, id: 5, status: 'processed' }]),
      ),
    });

    await serviceWith(paystack).reconcilePayments();

    expect(paystack.refund).not.toHaveBeenCalled();
  });

  it('re-issues when the only refund Paystack holds has failed', async () => {
    await refundedClaim(HOUR);
    const paystack = fakePaystack({
      listRefunds: vi.fn(() =>
        Promise.resolve([{ amount: 500, id: 5, status: 'failed' }]),
      ),
    });

    await serviceWith(paystack).reconcilePayments();

    expect(paystack.refund).toHaveBeenCalledTimes(1);
  });

  it('tolerates Paystack reporting the charge already refunded', async () => {
    await refundedClaim(HOUR);
    const paystack = fakePaystack({
      refund: vi.fn(() =>
        Promise.reject(
          new CustomError(409, 'already refunded', {
            code: 'PAYSTACK_ALREADY_REFUNDED',
            layer: 'paystack',
          }),
        ),
      ),
    });

    const summary = await serviceWith(paystack).reconcilePayments();

    expect(summary.refundsReissued).toBe(0);
  });

  it('records a dashboard refund the webhook never delivered', async () => {
    const { booking, payment } = await pendingCharge({ ageMs: 2 * HOUR });
    await prisma.payment.update({
      data: { status: 'COMPLETED' },
      where: { id: payment.id },
    });
    await prisma.booking.update({
      data: { status: 'CONFIRMED' },
      where: { id: booking.id },
    });
    const paystack = fakePaystack({
      listRefundsSince: vi.fn(() =>
        Promise.resolve([
          {
            amount: 500,
            id: 31,
            status: 'processed',
            transaction_reference: payment.transactionReference,
          },
        ]),
      ),
    });

    const summary = await serviceWith(paystack).reconcilePayments();

    expect(summary.providerRefundsApplied).toBe(1);
    const row = await prisma.payment.findUnique({ where: { id: payment.id } });
    expect(row?.status).toBe('REFUNDED');
    expect(row?.providerRefundId).toBe(31);
    const cancelled = await prisma.booking.findUnique({
      where: { id: booking.id },
    });
    expect(cancelled?.status).toBe('CANCELLED');
  });

  it('cancels a booking still holding inventory for a refunded payment', async () => {
    const { booking, payment } = await pendingCharge({ ageMs: 2 * HOUR });
    await prisma.payment.update({
      data: {
        providerRefundId: 1,
        refundedAt: new Date(NOW.getTime() - HOUR),
        status: 'REFUNDED',
      },
      where: { id: payment.id },
    });
    await prisma.booking.update({
      data: { status: 'CONFIRMED' },
      where: { id: booking.id },
    });
    const paystack = fakePaystack({
      listRefunds: vi.fn(() =>
        Promise.resolve([{ amount: 500, id: 1, status: 'processed' }]),
      ),
    });

    const summary = await serviceWith(paystack).reconcilePayments();

    expect(summary.bookingsCancelled).toBe(1);
    const cancelled = await prisma.booking.findUnique({
      where: { id: booking.id },
    });
    expect(cancelled?.status).toBe('CANCELLED');
  });
});
