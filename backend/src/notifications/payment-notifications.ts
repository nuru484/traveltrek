// src/notifications/payment-notifications.ts
//
// Payment-lifecycle notifications (receipt / refund processed), fired
// fire-and-forget from payment.service. Inputs are plain shapes the service
// already holds — no extra queries, no Prisma coupling. Channel + failure
// discipline live in deliver.ts (email when the customer has one, else SMS;
// never throws).
import { type AppDeps } from '#services/deps.js';

import { type CustomerContact, formatGhs, makeDeliver } from './deliver.js';

export interface PaymentNoticeInput {
  /** Integer pesewas. */
  amount: number;
  bookingId: number;
  customer: CustomerContact;
  /** Human description of what was paid for (see bookedItemName). */
  itemName: string;
  reference: null | string;
}

export const makePaymentNotifications = (
  d: Pick<AppDeps, 'config' | 'logger' | 'mail' | 'sms'>,
) => {
  const deliver = makeDeliver(d);

  /** Payment COMPLETED (webhook or manual/cash completion) — the receipt. */
  const paymentReceipt = (input: PaymentNoticeInput): void => {
    const amount = formatGhs(input.amount);
    const reference = input.reference ?? 'n/a';

    deliver(
      input.customer,
      {
        emailText:
          `Hi ${input.customer.name},\n\n` +
          `We've received your payment of ${amount} for booking #${input.bookingId} (${input.itemName}).\n\n` +
          `Reference: ${reference}\n\n` +
          `Your booking is confirmed — you can view it any time at ${d.config.FRONTEND_URL}. ` +
          `Please keep this message as your receipt.\n\n` +
          `Thank you for choosing TravelTrek.`,
        sms: `TravelTrek: payment of ${amount} received for booking #${input.bookingId} (${input.itemName}). Ref ${reference}.`,
        subject: `Payment received for booking #${input.bookingId}`,
      },
      'Payment-receipt notice',
    );
  };

  /** Payment moved to REFUNDED by an admin. */
  const refundProcessed = (input: PaymentNoticeInput): void => {
    const amount = formatGhs(input.amount);
    const reference = input.reference ?? 'n/a';

    deliver(
      input.customer,
      {
        emailText:
          `Hi ${input.customer.name},\n\n` +
          `Your refund of ${amount} for booking #${input.bookingId} (${input.itemName}) has been processed.\n\n` +
          `Reference: ${reference}\n\n` +
          `Depending on your payment provider, the money may take a few business days to reflect.\n\n` +
          `TravelTrek`,
        sms: `TravelTrek: refund of ${amount} processed for booking #${input.bookingId} (${input.itemName}). Ref ${reference}.`,
        subject: `Refund processed for booking #${input.bookingId}`,
      },
      'Refund-processed notice',
    );
  };

  return { paymentReceipt, refundProcessed };
};

export type PaymentNotifications = ReturnType<typeof makePaymentNotifications>;
