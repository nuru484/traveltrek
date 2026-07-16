// src/jobs/flightQueue.ts
import { Queue } from 'bullmq';

import { createRedisConnection } from '../config/redisConnection';

export const flightStatusQueue = new Queue('flightStatusQueue', {
  connection: createRedisConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { delay: 5000, type: 'exponential' },
    removeOnComplete: 100,
    removeOnFail: false,
  },
});
