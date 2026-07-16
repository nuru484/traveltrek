// src/notifications/booking-notifications.ts
//
// Booking-lifecycle notifications (created / confirmed / cancelled), fired
// fire-and-forget from booking.service and the deadline-expiry sweep. Inputs
// are structural slices of the rows the services already hold — no extra
// queries here, no Prisma coupling. Channel + failure discipline live in
// deliver.ts (email when the customer has one, else SMS; never throws).
import { type AppDeps } from '#services/deps.js';

import {
  type CustomerContact,
  formatDate,
  formatDateTime,
  formatGhs,
  makeDeliver,
} from './deliver.js';

export interface BookingNoticeInput {
  booking: BookingRowForNotice;
  customer: CustomerContact;
}

/** The booking slice a notice renders — satisfied by the include shapes the
 * services already fetch (richer rows pass structurally). */
export interface BookingRowForNotice {
  /** Room-stay check-out (bookings own the stay window). */
  endDate: Date | null;
  flight: null | {
    airline: string;
    /** Optional: some call sites only fetch the flight summary. */
    departure?: Date;
    flightNumber: string;
  };
  id: number;
  room: null | { hotel?: null | { name: string }; roomType: string };
  /** Room-stay check-in. */
  startDate: Date | null;
  totalPrice: number;
  tour: null | { endDate?: Date; name: string; startDate?: Date };
}

/** Human description of what was booked: "Kakum Canopy Tour", "DOUBLE room
 * at Hotel Accra", "flight TA-1001 (Test Air)". */
export const bookedItemName = (
  booking: Pick<BookingRowForNotice, 'flight' | 'room' | 'tour'>,
): string => {
  if (booking.tour) return booking.tour.name;
  if (booking.room) {
    return booking.room.hotel
      ? `${booking.room.roomType} room at ${booking.room.hotel.name}`
      : `${booking.room.roomType} room`;
  }
  if (booking.flight) {
    return `flight ${booking.flight.flightNumber} (${booking.flight.airline})`;
  }
  return 'your booking';
};

/** "Trip dates: 12 Aug 2026 – 19 Aug 2026" / "Departure: …" line, or ''. */
const tripDatesLine = (booking: BookingRowForNotice): string => {
  if (booking.tour?.startDate && booking.tour.endDate) {
    return `Trip dates: ${formatDate(booking.tour.startDate)} – ${formatDate(booking.tour.endDate)}\n`;
  }
  if (booking.room && booking.startDate && booking.endDate) {
    return `Stay: ${formatDate(booking.startDate)} – ${formatDate(booking.endDate)}\n`;
  }
  if (booking.flight?.departure) {
    return `Departure: ${formatDateTime(booking.flight.departure)}\n`;
  }
  return '';
};

export const makeBookingNotifications = (
  d: Pick<AppDeps, 'config' | 'logger' | 'mail' | 'sms'>,
) => {
  const deliver = makeDeliver(d);

  /** New booking recorded (PENDING) — includes the payment deadline when the
   * booking has one, and where to pay. */
  const bookingCreated = (
    input: BookingNoticeInput,
    opts: { paymentDeadline: Date | null },
  ): void => {
    const { booking, customer } = input;
    const item = bookedItemName(booking);
    const total = formatGhs(booking.totalPrice);
    const deadline = opts.paymentDeadline
      ? formatDateTime(opts.paymentDeadline)
      : null;

    deliver(
      customer,
      {
        emailText:
          `Hi ${customer.name},\n\n` +
          `We've received your booking #${booking.id} for ${item}. ` +
          `It is pending payment.\n\n` +
          tripDatesLine(booking) +
          `Total due: ${total}\n` +
          (deadline
            ? `\nPlease complete payment by ${deadline} — unpaid bookings are cancelled automatically after the deadline.\n`
            : '\n') +
          `\nYou can pay online from your account at ${d.config.FRONTEND_URL}.\n\n` +
          `Thank you for booking with TravelTrek.`,
        sms:
          `TravelTrek: booking #${booking.id} for ${item} received. ` +
          `Total ${total}.` +
          (deadline ? ` Pay by ${deadline} to confirm.` : ''),
        subject: `Booking #${booking.id} received — payment pending`,
      },
      'Booking-created notice',
    );
  };

  /** Booking moved to CONFIRMED. */
  const bookingConfirmed = (input: BookingNoticeInput): void => {
    const { booking, customer } = input;
    const item = bookedItemName(booking);
    const total = formatGhs(booking.totalPrice);

    deliver(
      customer,
      {
        emailText:
          `Hi ${customer.name},\n\n` +
          `Great news — your booking #${booking.id} for ${item} is now confirmed.\n\n` +
          tripDatesLine(booking) +
          `Total: ${total}\n\n` +
          `We look forward to having you. Safe travels!\n\n` +
          `TravelTrek`,
        sms: `TravelTrek: booking #${booking.id} for ${item} is confirmed. Total ${total}. Safe travels!`,
        subject: `Booking #${booking.id} confirmed`,
      },
      'Booking-confirmed notice',
    );
  };

  /**
   * Booking moved to CANCELLED. Two variants: `customer` (self-cancel or a
   * staff cancellation) and `deadline` (the payment deadline expired before
   * payment). `refundRequested` adds the refund-in-progress note for a paid
   * booking a customer cancelled.
   */
  const bookingCancelled = (
    input: BookingNoticeInput,
    opts: { reason: 'customer' | 'deadline'; refundRequested?: boolean },
  ): void => {
    const { booking, customer } = input;
    const item = bookedItemName(booking);
    const total = formatGhs(booking.totalPrice);

    const why =
      opts.reason === 'deadline'
        ? `your booking #${booking.id} for ${item} was cancelled because the payment deadline passed before payment was completed`
        : `your booking #${booking.id} for ${item} has been cancelled`;

    const refundNote = opts.refundRequested
      ? `\nYour payment of ${total} is being processed for a refund — we'll confirm once it has been issued.\n`
      : '';

    deliver(
      customer,
      {
        emailText:
          `Hi ${customer.name},\n\n` +
          `This is to confirm that ${why}.\n` +
          refundNote +
          `\nYou're welcome to book again any time at ${d.config.FRONTEND_URL}.\n\n` +
          `TravelTrek`,
        sms:
          `TravelTrek: booking #${booking.id} for ${item} ` +
          (opts.reason === 'deadline'
            ? 'was cancelled (payment deadline passed).'
            : 'has been cancelled.') +
          (opts.refundRequested ? ` Refund of ${total} in progress.` : ''),
        subject: `Booking #${booking.id} cancelled`,
      },
      'Booking-cancelled notice',
    );
  };

  return { bookingCancelled, bookingConfirmed, bookingCreated };
};

export type BookingNotifications = ReturnType<typeof makeBookingNotifications>;
