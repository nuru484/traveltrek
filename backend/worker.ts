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
import { flushSentry, initSentry, reportFatal } from '#lib/sentry.js';
import { shutdownExitCode, type ShutdownReason } from '#lib/shutdown.js';
import logger from '#utils/logger.js';

// Error tracking for the worker process too (no-op without SENTRY_DSN).
initSentry();

let shuttingDown = false;

const shutdown = async (signal: ShutdownReason): Promise<void> => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`Received ${signal}, shutting down workers...`);

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
    process.exit(shutdownExitCode(signal));
  } catch (error) {
    logger.error(error, 'Error during worker shutdown');
    process.exit(1);
  }
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

// A rejection with no catch handler leaves the process in an unknown state:
// report it, then shut down cleanly and let the platform restart the process.
process.on('unhandledRejection', (reason) => {
  logger.error(reason, 'Unhandled promise rejection');
  void reportFatal(reason, 'unhandledRejection').finally(() =>
    shutdown('unhandledRejection'),
  );
});

process.on('uncaughtException', (error) => {
  // Straight to stderr as well as through pino: an exception thrown by the
  // log sink itself would otherwise be reported into the sink that just died,
  // and the process would exit without a word about why.
  console.error(error);
  logger.fatal(error, 'Uncaught exception');
  void reportFatal(error, 'uncaughtException').finally(() =>
    shutdown('uncaughtException'),
  );
});

startWorkers().catch((err: unknown) => {
  logger.error({ err }, 'Failed to start worker');
  process.exit(1);
});
