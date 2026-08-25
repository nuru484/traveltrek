// src/jobs/paymentWorker.ts
//
// Thin BullMQ trigger for the payment reconciliation sweep. The domain logic
// (confirm settled charges the webhook and callback both missed, close
// abandoned ones, re-issue refunds Paystack never received, record refunds
// issued on the Paystack dashboard) lives in payment.service's
// reconcilePayments so it is testable without Redis.
import { Worker } from 'bullmq';

import { createRedisConnection } from '#config/redisConnection.js';
import { reconcilePayments } from '#services/payment.service.js';
import logger from '#utils/logger.js';

export const paymentReconciliationWorker = new Worker(
  'paymentReconciliationQueue',
  async (_job) => {
    logger.info('Reconciling payments against Paystack...');
    return reconcilePayments();
  },
  {
    // One tick at a time: the stages are idempotent, but two concurrent ticks
    // would spend provider calls asking the same questions twice.
    concurrency: 1,
    connection: createRedisConnection(),
  },
);

paymentReconciliationWorker.on('failed', (job, err) => {
  logger.error(`Payment reconciliation job ${job?.id} failed: ${err.message}`);
});

paymentReconciliationWorker.on('completed', (job) => {
  logger.info(`Payment reconciliation job ${job.id} completed.`);
});
