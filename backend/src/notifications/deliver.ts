// src/notifications/deliver.ts
//
// Channel selection + shared formatting for customer-facing transactional
// notifications. One rule everywhere: EMAIL when the customer has one
// (durable, free), else SMS, else the notification is skipped with a log
// line. Delivery goes through the injected NotifyClient (the durable BullMQ
// queue in production — see src/notifications/notify.ts); from the caller's
// view it is enqueue-and-forget, so a send can never block or fail the
// request/job that triggered it.
import { type AppDeps } from '#services/deps.js';

/** The contact slice a notification needs — decoupled from Prisma rows. */
export interface CustomerContact {
  email: null | string;
  name: string;
  phone: null | string;
}

/** A rendered message: full plain-text email body + compact SMS variant. */
export interface CustomerMessage {
  emailText: string;
  sms: string;
  subject: string;
}

export type Deliver = (
  to: CustomerContact,
  message: CustomerMessage,
  what: string,
) => void;

/** "GHS 1,234.50" from integer pesewas (GH₵ is not GSM-7-safe for SMS). */
export const formatGhs = (minor: number): string =>
  `GHS ${new Intl.NumberFormat('en-GH', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(minor / 100)}`;

/** "16 Jul 2026" — UTC so rendered dates don't shift with server timezone. */
export const formatDate = (date: Date): string =>
  new Intl.DateTimeFormat('en-GH', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(date);

/** "16 Jul 2026, 14:30 GMT" for instants like payment deadlines. */
export const formatDateTime = (date: Date): string =>
  new Intl.DateTimeFormat('en-GH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(date);

/** Builds the email-first / SMS-fallback sender for a module's deps. */
export const makeDeliver = (
  d: Pick<AppDeps, 'logger' | 'notify'>,
): Deliver => {
  return (to, message, what) => {
    if (to.email) {
      d.notify.email(
        {
          subject: message.subject,
          text: message.emailText,
          to: to.email,
        },
        what,
      );
    } else if (to.phone) {
      d.notify.sms({ message: message.sms, to: to.phone }, what);
    } else {
      d.logger.warn(
        { what },
        'Notification skipped — customer has no email or phone on file',
      );
    }
  };
};
