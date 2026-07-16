// src/jobs/tourQueue.ts
import { Queue } from 'bullmq';

import { createRedisConnection } from '#config/redisConnection.js';

export const tourStatusQueue = new Queue('tourStatusQueue', {
  connection: createRedisConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { delay: 5000, type: 'exponential' },
    removeOnComplete: 100,
    removeOnFail: false,
  },
});
