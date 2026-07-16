// src/jobs/schedulers.ts
import { bookingDeadlineQueue } from '#jobs/bookingQueue.js';
import { flightStatusQueue } from '#jobs/flightQueue.js';
import { tourStatusQueue } from '#jobs/tourQueue.js';
import logger from '#utils/logger.js';

export async function setupJobSchedulers() {
  // Schedule booking deadline check - runs every 5 minutes
  await bookingDeadlineQueue.add(
    'check-booking-deadlines',
    {},
    {
      repeat: {
        pattern: '*/5 * * * *', // Every 5 minutes
      },
    },
  );

  logger.info('📅 Scheduled: Booking deadline checker (every 5 minutes)');

  // Schedule flight status update - runs every 15 minutes
  await flightStatusQueue.add(
    'update-flight-statuses',
    {},
    {
      repeat: {
        pattern: '*/15 * * * *', // Every 15 minutes
      },
    },
  );

  logger.info('📅 Scheduled: Flight status updater (every 15 minutes)');

  // Schedule tour status update - runs every 30 minutes
  await tourStatusQueue.add(
    'update-tour-statuses',
    {},
    {
      repeat: {
        pattern: '*/30 * * * *', // Every 30 minutes
      },
    },
  );

  logger.info('📅 Scheduled: Tour status updater (every 30 minutes)');
}
