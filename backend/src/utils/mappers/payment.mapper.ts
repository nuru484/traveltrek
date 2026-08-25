// src/utils/mappers/payment.mapper.ts
//
// Pure DTO mapper for the payment domain. Services return Prisma rows (with
// `paymentInclude` relations); controllers map them through here so the wire
// format lives in exactly one place and raw DB records never leak.
//
// toPaymentDTO also derives the `bookedItem` block: TOUR / ROOM / FLIGHT
// checked in that order, each with its own name/description composition, and
// an 'Unknown Item' TOUR fallback (carrying the booking id) for a booking
// with no associated item. Payments belong to Customers, so the DTO carries
// customerId plus a nested customer summary.
import type { Prisma } from '#config/prismaClient.js';

/** Relations every payment read fetches; services pass this to Prisma. */
export const paymentInclude = {
  booking: {
    include: {
      flight: {
        include: {
          destination: true,
          origin: true,
        },
      },
      room: {
        include: {
          hotel: true,
        },
      },
      tour: true,
    },
  },
  customer: {
    select: { email: true, id: true, name: true },
  },
} satisfies Prisma.PaymentInclude;

/** The booked item a payment ultimately paid for; derived, not stored. */
export interface PaymentBookedItemDTO {
  description: null | string;
  id: number;
  name: string;
  type: 'FLIGHT' | 'ROOM' | 'TOUR';
}

export interface PaymentDTO {
  amount: number;
  bookedItem: PaymentBookedItemDTO;
  bookingId: number;
  createdAt: Date;
  currency: string;
  customer: PaymentWithRelations['customer'];
  customerId: number;
  id: number;
  paymentDate: Date | null;
  paymentMethod: PaymentWithRelations['paymentMethod'];
  /** Paystack's id for the refund it holds against this charge, if any. */
  providerRefundId: null | number;
  /** When the reversal was claimed on the ledger; null unless REFUNDED. */
  refundedAt: Date | null;
  refundReason: null | string;
  status: PaymentWithRelations['status'];
  transactionReference: string;
  updatedAt: Date;
}

export type PaymentWithRelations = Prisma.PaymentGetPayload<{
  include: typeof paymentInclude;
}>;

/** Derives the booked item from the payment's booking. */
const toBookedItemDTO = (
  booking: PaymentWithRelations['booking'],
): PaymentBookedItemDTO => {
  if (booking.tour) {
    return {
      description: booking.tour.description,
      id: booking.tour.id,
      name: booking.tour.name,
      type: 'TOUR',
    };
  } else if (booking.room) {
    return {
      description: booking.room.description,
      id: booking.room.id,
      name: `${booking.room.hotel.name} - ${booking.room.roomType}`,
      type: 'ROOM',
    };
  } else if (booking.flight) {
    return {
      description: `${booking.flight.origin.name} to ${booking.flight.destination.name}`,
      id: booking.flight.id,
      name: `${booking.flight.airline} ${booking.flight.flightNumber}`,
      type: 'FLIGHT',
    };
  }

  return {
    description: null,
    id: booking.id,
    name: 'Unknown Item',
    type: 'TOUR',
  };
};

export const toPaymentDTO = (payment: PaymentWithRelations): PaymentDTO => ({
  amount: payment.amount,
  bookedItem: toBookedItemDTO(payment.booking),
  bookingId: payment.bookingId,
  createdAt: payment.createdAt,
  currency: payment.currency,
  customer: payment.customer,
  customerId: payment.customerId,
  id: payment.id,
  paymentDate: payment.paymentDate,
  paymentMethod: payment.paymentMethod,
  providerRefundId: payment.providerRefundId,
  refundedAt: payment.refundedAt,
  refundReason: payment.refundReason,
  status: payment.status,
  transactionReference: payment.transactionReference ?? '',
  updatedAt: payment.updatedAt,
});
