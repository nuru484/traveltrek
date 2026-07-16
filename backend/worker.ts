// worker.ts
import { bookingDeadlineWorker } from '#jobs/bookingWorker.js';
import { flightStatusWorker } from '#jobs/flightWorker.js';
import { setupJobSchedulers } from '#jobs/schedulers.js';
import { tourStatusWorker } from '#jobs/tourWorker.js';
import logger from '#utils/logger.js';

async function shutdownWorkers(signal: string) {
  logger.info(`🛑 Received ${signal}, shutting down workers...`);

  await Promise.all([
    bookingDeadlineWorker.close(),
    flightStatusWorker.close(),
    tourStatusWorker.close(),
  ]);

  logger.info('✅ All workers closed gracefully');
  process.exit(0);
}

async function startWorker() {
  logger.info('🚀 Starting background workers...');

  await setupJobSchedulers();

  logger.info('✅ All workers started and listening for jobs...');
  logger.info('📧 Booking Deadline Worker: Active');
  logger.info('✈️  Flight Status Worker: Active');
  logger.info('🗺️  Tour Status Worker: Active');
}

// Graceful shutdown
process.on('SIGINT', () => {
  void shutdownWorkers('SIGINT');
});

process.on('SIGTERM', () => {
  void shutdownWorkers('SIGTERM');
});

// Start the worker
startWorker().catch((err: unknown) => {
  logger.error({ err }, '❌ Failed to start worker');
  process.exit(1);
});
