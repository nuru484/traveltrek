// src/notifications/critical.ts
//
// The other half of dispatch.ts. Notifications are fire-and-forget because a
// receipt must never fail a payment; the emails here are the opposite kind -
// a sign-in code, a reset link, a confirmation - where the person is sitting
// on the screen waiting. Those are awaited, and a delivery failure becomes a
// 503 rather than a silent "we sent it" for mail that never left.
import type { SendMailParams } from '#lib/mail.js';
import type { AppDeps } from '#services/deps.js';

import { ServiceUnavailableError } from '#middlewares/error-handler.js';

export type SendCritical = (
  params: SendMailParams,
  what: string,
) => Promise<void>;

/** Builds the awaited, loud-on-failure sender for a module's deps. */
export const makeSendCritical =
  (d: Pick<AppDeps, 'logger' | 'mail'>): SendCritical =>
  async (params, what) => {
    try {
      await d.mail.send(params);
    } catch (error) {
      d.logger.error({ err: error, to: params.to, what }, 'Critical email failed');
      throw new ServiceUnavailableError(
        'We could not send that email just now. Please try again in a moment.',
        { code: 'EMAIL_DELIVERY_FAILED', layer: 'notifications' },
      );
    }
  };
