// src/jobs/lifecycle.ts
//
// Single owner of the BullMQ worker lifecycle, shared by both entrypoints:
//   - server.ts starts the workers in-process (the default, saves a dyno)
//     unless WEB_DISABLE_WORKERS=true,
//   - worker.ts is a thin standalone entry for a dedicated worker process.
// Workers/queues are created at module load in their own files, so they are
// imported LAZILY here: a web process with workers disabled never opens a
// single BullMQ Redis connection.
import type { Queue, Worker } from 'bullmq';

import logger from '#utils/logger.js';

interface RunningJobs {
  queues: Queue[];
  workers: Worker[];
}

let running: null | RunningJobs = null;

/**
 * Start the BullMQ workers and register the repeating job schedulers.
 * Idempotent within a process; schedulers use upsertJobScheduler, so repeated
 * boots (or web + standalone racing) can never double-schedule a job.
 */
export async function startWorkers(): Promise<void> {
  if (running) return;

  logger.info('Starting background workers...');

  const [
    { bookingDeadlineWorker },
    { flightStatusWorker },
    { tourStatusWorker },
    { notificationWorker },
    { bookingDeadlineQueue },
    { flightStatusQueue },
    { tourStatusQueue },
    { notificationQueue },
    { setupJobSchedulers },
  ] = await Promise.all([
    import('#jobs/bookingWorker.js'),
    import('#jobs/flightWorker.js'),
    import('#jobs/tourWorker.js'),
    import('#jobs/notificationWorker.js'),
    import('#jobs/bookingQueue.js'),
    import('#jobs/flightQueue.js'),
    import('#jobs/tourQueue.js'),
    import('#jobs/notificationQueue.js'),
    import('#jobs/schedulers.js'),
  ]);

  await setupJobSchedulers();

  running = {
    queues: [
      bookingDeadlineQueue,
      flightStatusQueue,
      tourStatusQueue,
      notificationQueue,
    ],
    workers: [
      bookingDeadlineWorker,
      flightStatusWorker,
      tourStatusWorker,
      notificationWorker,
    ],
  };

  logger.info('All workers started and listening for jobs...');
  logger.info('Booking Deadline Worker: Active');
  logger.info('✈️  Flight Status Worker: Active');
  logger.info('Tour Status Worker: Active');
  logger.info('✉️  Notification Worker: Active');
}

/**
 * Close every worker (waits for in-flight jobs) and queue connection.
 * Safe to call when workers were never started.
 */
export async function stopWorkers(): Promise<void> {
  if (!running) return;
  const { queues, workers } = running;
  running = null;

  await Promise.all(workers.map((worker) => worker.close()));
  await Promise.all(queues.map((queue) => queue.close()));

  logger.info('All workers closed gracefully');
}
