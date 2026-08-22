// src/notifications/notify.ts
//
// The durable notification channel. Production sends are enqueued onto the
// BullMQ notificationQueue (3 attempts, exponential backoff — see
// src/jobs/notificationQueue.ts) so a crashed process or a flaky SMTP/SMS
// provider cannot lose a customer notification; a send that exhausts
// its attempts stays in Redis as a failed job for inspection. The queue
// module is imported lazily on first use, so merely importing the service
// layer never opens a Redis connection (scripts, tests).
//
// NOTIFICATIONS_INLINE=true swaps in the direct fire-and-forget send. That is
// the seam the test suite uses (vitest.config.ts): the mocked sendMail /
// sendSms capture messages synchronously without Redis.
import type { SendMailParams } from '#lib/mail.js';
import type { SendSmsParams } from '#lib/sms.js';
import type { Logger, MailClient, SmsClient } from '#services/deps.js';

import { makeDispatch } from './dispatch.js';

/** One queued send; `what` labels the notification in logs and failed jobs. */
export type NotificationJob =
  | { channel: 'EMAIL'; params: SendMailParams; what: string }
  | { channel: 'SMS'; params: SendSmsParams; what: string };

/** Outbound notification surface; enqueue-and-forget from the caller's view. */
export interface NotifyClient {
  email: (params: SendMailParams, what: string) => void;
  sms: (params: SendSmsParams, what: string) => void;
}

/**
 * Production wiring: sends become durable queue jobs. Enqueueing itself is
 * still fire-and-forget — a Redis hiccup is logged, never surfaced into the
 * request or job that triggered the notification.
 */
export const makeQueuedNotify = (logger: Logger): NotifyClient => {
  const enqueue = (job: NotificationJob): void => {
    void import('#jobs/notificationQueue.js')
      .then(({ notificationQueue }) => notificationQueue.add(job.channel, job))
      .catch((error: unknown) => {
        logger.error(
          { err: error, what: job.what },
          'Notification enqueue failed',
        );
      });
  };

  return {
    email: (params, what) => {
      enqueue({ channel: 'EMAIL', params, what });
    },
    sms: (params, what) => {
      enqueue({ channel: 'SMS', params, what });
    },
  };
};

/**
 * Inline wiring (NOTIFICATIONS_INLINE=true): a direct send through the
 * shared fire-and-forget dispatch helper. No durability or retries —
 * meant for tests and Redis-less local runs only.
 */
export const makeInlineNotify = (d: {
  logger: Logger;
  mail: MailClient;
  sms: SmsClient;
}): NotifyClient => {
  const dispatch = makeDispatch(d.logger);

  return {
    email: (params, what) => {
      dispatch(d.mail.send(params), what);
    },
    sms: (params, what) => {
      dispatch(d.sms.send(params), what);
    },
  };
};
