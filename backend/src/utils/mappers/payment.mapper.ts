// src/utils/mappers/payment.mapper.ts
//
// Pure DTO mapper for the payment domain. Services return Prisma rows (with
// `paymentInclude` relations); controllers map them through here so the wire
// format lives in exactly one place and raw DB records never leak.
//
// toPaymentDTO reproduces the legacy response shape bit-for-bit, including
// the derived `bookedItem` block (legacy getBookedItemFromBooking): TOUR /
// ROOM / FLIGHT checked in that order, with the same name/description
// composition, and the same 'Unknown Item' TOUR fallback (carrying the
// booking id) for a booking with no associated item.
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
  user: {
    select: { email: true, id: true, name: true },
  },
} satisfies Prisma.PaymentInclude;

/** The booked item a payment ultimately paid for (legacy derived block). */
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
  id: number;
  paymentDate: Date | null;
  paymentMethod: PaymentWithRelations['paymentMethod'];
  status: PaymentWithRelations['status'];
  transactionReference: string;
  updatedAt: Date;
  user: PaymentWithRelations['user'];
  userId: number;
}

export type PaymentWithRelations = Prisma.PaymentGetPayload<{
  include: typeof paymentInclude;
}>;

/** Derives the booked item from the payment's booking (legacy helper). */
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
  id: payment.id,
  paymentDate: payment.paymentDate,
  paymentMethod: payment.paymentMethod,
  status: payment.status,
  transactionReference: payment.transactionReference ?? '',
  updatedAt: payment.updatedAt,
  user: payment.user,
  userId: payment.userId,
});
