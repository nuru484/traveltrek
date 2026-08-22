// src/jobs/bookingWorker.ts
//
// Thin BullMQ trigger for the booking payment-deadline sweep. The actual
// domain logic (find expired PENDING bookings, cancel + restore counters
// atomically, notify the customer) lives in booking.service's
// cancelExpiredBookings so it is unit-testable without Redis.
import { Worker } from 'bullmq';

import { createRedisConnection } from '#config/redisConnection.js';
import { cancelExpiredBookings } from '#services/booking.service.js';
import logger from '#utils/logger.js';

export const bookingDeadlineWorker = new Worker(
  'bookingDeadlineQueue',
  async (_job) => {
    logger.info('Checking for expired booking payment deadlines...');

    const summary = await cancelExpiredBookings();

    if (summary.cancelledCount === 0 && summary.failureCount === 0) {
      logger.info('No expired bookings found.');
    } else {
      logger.info(
        `Booking deadline check completed. Cancelled: ${summary.cancelledCount}, Failures: ${summary.failureCount}`,
      );
    }

    return summary;
  },
  {
    connection: createRedisConnection(),
  },
);

bookingDeadlineWorker.on('failed', (job, err) => {
  logger.error(`Booking deadline job ${job?.id} failed: ${err.message}`);
});

bookingDeadlineWorker.on('completed', (job) => {
  logger.info(`Booking deadline job ${job.id} completed successfully.`);
});
