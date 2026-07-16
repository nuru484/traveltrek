// src/jobs/notificationWorker.ts
//
// Thin BullMQ trigger for outbound notification delivery: performs the real
// sendMail/sendSms for jobs enqueued via the NotifyClient. A thrown send
// makes BullMQ retry per the queue's backoff policy; after the final attempt
// the job stays marked failed (removeOnFail: false) and is logged as
// permanently failed.
import { Worker } from 'bullmq';

import { createRedisConnection } from '#config/redisConnection.js';
import { sendMail } from '#lib/mail.js';
import { sendSms } from '#lib/sms.js';
import { type NotificationJob } from '#notifications/notify.js';
import logger from '#utils/logger.js';

export const notificationWorker = new Worker<NotificationJob>(
  'notificationQueue',
  async (job) => {
    const data = job.data;

    if (data.channel === 'EMAIL') {
      await sendMail(data.params);
    } else {
      await sendSms(data.params);
    }
  },
  {
    connection: createRedisConnection(),
  },
);

notificationWorker.on('failed', (job, err) => {
  if (!job) {
    logger.error({ err }, '❌ Notification job failed (job data unavailable)');
    return;
  }

  const maxAttempts = job.opts.attempts ?? 1;
  if (job.attemptsMade >= maxAttempts) {
    logger.error(
      { err, what: job.data.what },
      `❌ Notification permanently failed after ${String(maxAttempts)} attempt(s)`,
    );
  } else {
    logger.warn(
      { err, what: job.data.what },
      `Notification attempt ${String(job.attemptsMade)}/${String(maxAttempts)} failed — retrying`,
    );
  }
});
