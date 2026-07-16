// src/jobs/notificationQueue.ts
//
// Durable delivery queue for outbound email/SMS notifications. Producers go
// through the NotifyClient in src/notifications/notify.ts (which imports this
// module lazily); the worker in notificationWorker.ts performs the actual
// sends. Each job gets 3 attempts with exponential backoff (5s, 10s, 20s);
// a job that exhausts them is kept as failed for inspection.
import { Queue } from 'bullmq';

import { createRedisConnection } from '#config/redisConnection.js';
import { type NotificationJob } from '#notifications/notify.js';

export const notificationQueue = new Queue<NotificationJob>(
  'notificationQueue',
  {
    connection: createRedisConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { delay: 5000, type: 'exponential' },
      removeOnComplete: 100,
      removeOnFail: false,
    },
  },
);
