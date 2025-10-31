// worker.ts
import { bookingDeadlineWorker } from './src/jobs/bookingWorker';
import { flightStatusWorker } from './src/jobs/flightWorker';
import { tourStatusWorker } from './src/jobs/tourWorker';
import { setupJobSchedulers } from './src/jobs/schedulers';
import logger from './src/utils/logger';

async function startWorker() {
  logger.info('🚀 Starting background workers...');

  await setupJobSchedulers();

  logger.info('✅ All workers started and listening for jobs...');
  logger.info('📧 Booking Deadline Worker: Active');
  logger.info('✈️  Flight Status Worker: Active');
  logger.info('🗺️  Tour Status Worker: Active');
}

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('🛑 Shutting down workers...');

  await Promise.all([
    bookingDeadlineWorker.close(),
    flightStatusWorker.close(),
    tourStatusWorker.close(),
  ]);

  logger.info('✅ All workers closed gracefully');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('🛑 Received SIGTERM, shutting down workers...');

  await Promise.all([
    bookingDeadlineWorker.close(),
    flightStatusWorker.close(),
    tourStatusWorker.close(),
  ]);

  logger.info('✅ All workers closed gracefully');
  process.exit(0);
});

// Start the worker
startWorker().catch((err) => {
  logger.error('❌ Failed to start worker:', err);
  process.exit(1);
});
