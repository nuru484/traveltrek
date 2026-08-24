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
  d: Pick<AppDeps, 'config' | 'logger' | 'notify'>,
) => {
  const deliver = makeDeliver(d);

  /** Payment COMPLETED (webhook or manual/cash completion) — the receipt. */
  const paymentReceipt = (input: PaymentNoticeInput): void => {
    const amount = formatGhs(input.amount);
    const reference = input.reference ?? 'n/a';

    deliver(
      input.customer,
      {
        data: {
          action: { label: 'View your booking', url: d.config.FRONTEND_URL },
          amount: { label: 'Payment received', value: amount },
          intro: [
            `Payment received for booking #${String(input.bookingId)} (${input.itemName}). Your booking is confirmed.`,
          ],
          name: input.customer.name,
          note: 'Keep this message as your receipt.',
          preview: `Payment of ${amount} received.`,
          rows: [
            { label: 'Booking', value: `#${String(input.bookingId)}` },
            { label: 'Item', value: input.itemName },
            { label: 'Reference', value: reference },
          ],
          rowsCaption: 'Payment record',
          title: 'Payment received',
        },
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
        data: {
          amount: { label: 'Refund processed', value: amount },
          intro: [
            `Your refund for booking #${String(input.bookingId)} (${input.itemName}) has been processed.`,
          ],
          name: input.customer.name,
          note: 'It may take a few business days to reflect, depending on your provider.',
          preview: `Refund of ${amount} processed.`,
          rows: [
            { label: 'Booking', value: `#${String(input.bookingId)}` },
            { label: 'Item', value: input.itemName },
            { label: 'Reference', value: reference },
          ],
          rowsCaption: 'Refund record',
          title: 'Your refund is on its way',
        },
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
