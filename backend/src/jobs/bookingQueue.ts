// src/jobs/bookingQueue.ts
import { Queue } from 'bullmq';
import { createRedisConnection } from '../config/redisConnection';

export const bookingDeadlineQueue = new Queue('bookingDeadlineQueue', {
  connection: createRedisConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: false,
  },
});
