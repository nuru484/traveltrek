// src/jobs/schedulers.ts
//
// Repeating jobs are registered with upsertJobScheduler (BullMQ's idempotent
// job-scheduler API, replacing the deprecated repeat-`add` pattern): re-running
// this on every boot — or from both the web and a standalone worker process —
// updates the one scheduler per id instead of stacking duplicate repeats.
import type { Queue } from 'bullmq';

import { bookingDeadlineQueue } from '#jobs/bookingQueue.js';
import { flightStatusQueue } from '#jobs/flightQueue.js';
import { tourStatusQueue } from '#jobs/tourQueue.js';
import logger from '#utils/logger.js';

export async function setupJobSchedulers() {
  // Booking deadline check - runs every 5 minutes
  await removeLegacyRepeatables(bookingDeadlineQueue, 'check-booking-deadlines');
  await bookingDeadlineQueue.upsertJobScheduler(
    'check-booking-deadlines',
    { pattern: '*/5 * * * *' },
    { name: 'check-booking-deadlines' },
  );

  logger.info('Scheduled: Booking deadline checker (every 5 minutes)');

  // Flight status update - runs every 15 minutes
  await removeLegacyRepeatables(flightStatusQueue, 'update-flight-statuses');
  await flightStatusQueue.upsertJobScheduler(
    'update-flight-statuses',
    { pattern: '*/15 * * * *' },
    { name: 'update-flight-statuses' },
  );

  logger.info('Scheduled: Flight status updater (every 15 minutes)');

  // Tour status update - runs every 30 minutes
  await removeLegacyRepeatables(tourStatusQueue, 'update-tour-statuses');
  await tourStatusQueue.upsertJobScheduler(
    'update-tour-statuses',
    { pattern: '*/30 * * * *' },
    { name: 'update-tour-statuses' },
  );

  logger.info('Scheduled: Tour status updater (every 30 minutes)');
}

/**
 * One-time migration sweep: the deprecated repeat-`add` pattern stored its
 * repeatables under an opaque hashed key, so they coexist with (and double-fire
 * alongside) the named scheduler upsertJobScheduler registers. Remove every
 * scheduler entry whose key is not the scheduler id we own.
 */
async function removeLegacyRepeatables(
  queue: Queue,
  schedulerId: string,
): Promise<void> {
  const schedulers = await queue.getJobSchedulers();
  const legacy = schedulers.filter((job) => job.key !== schedulerId);

  await Promise.all(
    legacy.map(async (job) => {
      await queue.removeJobScheduler(job.key);
      logger.info(`Removed legacy repeatable ${job.key} from ${queue.name}`);
    }),
  );
}
