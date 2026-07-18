// worker.ts
//
// Thin standalone entrypoint for a dedicated worker process (`npm run worker`).
// The actual worker lifecycle lives in src/jobs/lifecycle.ts and is shared
// with server.ts (which runs the workers in-process by default). When running
// this entry, set WEB_DISABLE_WORKERS=true on the web process so jobs are
// never processed twice.
import prisma from '#config/prismaClient.js';
import { startWorkers, stopWorkers } from '#jobs/lifecycle.js';
import { closeRedisClient } from '#lib/redis.js';
import { flushSentry, initSentry } from '#lib/sentry.js';
import logger from '#utils/logger.js';

// Error tracking for the worker process too (no-op without SENTRY_DSN).
initSentry();

let shuttingDown = false;

const shutdown = async (signal: string): Promise<void> => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`🛑 Received ${signal}, shutting down workers...`);

  const forceExit = setTimeout(() => {
    logger.error('Graceful shutdown timed out; forcing exit');
    process.exit(1);
  }, 35_000);
  forceExit.unref();

  try {
    await stopWorkers();
    // Jobs invalidate the shared authz cache through this client.
    await closeRedisClient();
    await flushSentry();
    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    logger.error(error, 'Error during worker shutdown');
    process.exit(1);
  }
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error(reason, 'Unhandled promise rejection');
});

process.on('uncaughtException', (error) => {
  logger.fatal(error, 'Uncaught exception');
  void shutdown('uncaughtException');
});

startWorkers().catch((err: unknown) => {
  logger.error({ err }, '❌ Failed to start worker');
  process.exit(1);
});
