// src/jobs/notificationWorker.ts
//
// Thin BullMQ trigger for outbound notification delivery: performs the real
// sendMail/sendSms for jobs enqueued via the NotifyClient. A thrown send
// makes BullMQ retry per the queue's backoff policy; after the final attempt
// the job stays marked failed (removeOnFail: false) and is logged as
// permanently failed. A job enqueued during a request replays that request's
// context, so the send's own log lines carry the originating requestId.
import { Worker } from 'bullmq';

import { createRedisConnection } from '#config/redisConnection.js';
import { sendMail } from '#lib/mail.js';
import { requestContext } from '#lib/request-context.js';
import { sendSms } from '#lib/sms.js';
import { type NotificationJob } from '#notifications/notify.js';
import logger from '#utils/logger.js';

export const notificationWorker = new Worker<NotificationJob>(
  'notificationQueue',
  async (job) => {
    const data = job.data;
    const deliver = async (): Promise<void> => {
      if (data.channel === 'EMAIL') {
        await sendMail(data.params);
      } else {
        await sendSms(data.params);
      }
    };

    if (!data.requestId) return deliver();
    return requestContext.run({ requestId: data.requestId }, deliver);
  },
  {
    connection: createRedisConnection(),
  },
);

notificationWorker.on('failed', (job, err) => {
  if (!job) {
    logger.error({ err }, 'Notification job failed (job data unavailable)');
    return;
  }

  const maxAttempts = job.opts.attempts ?? 1;
  if (job.attemptsMade >= maxAttempts) {
    logger.error(
      {
        err,
        jobId: job.id,
        requestId: job.data.requestId,
        what: job.data.what,
      },
      `Notification permanently failed after ${String(maxAttempts)} attempt(s)`,
    );
  } else {
    logger.warn(
      {
        err,
        jobId: job.id,
        requestId: job.data.requestId,
        what: job.data.what,
      },
      `Notification attempt ${String(job.attemptsMade)}/${String(maxAttempts)} failed — retrying`,
    );
  }
});
