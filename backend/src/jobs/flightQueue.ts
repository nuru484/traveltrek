// src/jobs/flightQueue.ts
import { Queue } from 'bullmq';
import { createRedisConnection } from '../config/redisConnection';

export const flightStatusQueue = new Queue('flightStatusQueue', {
  connection: createRedisConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: false,
  },
});
