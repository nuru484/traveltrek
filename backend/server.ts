// server.ts
import type { Server } from 'node:http';

import ENV from '#config/env.js';
import prisma from '#config/prismaClient.js';
import { startWorkers, stopWorkers } from '#jobs/lifecycle.js';
import logger from '#utils/logger.js';

import app from './app.js';

const port = ENV.PORT || 8080;

const server: Server = app.listen(port, () => {
  const message =
    ENV.NODE_ENV === 'production'
      ? `App is running in production mode on port ${port}`
      : `App is listening on http://localhost:${port}`;
  logger.info(message);
});

// Background workers run in-process by default (saves a dyno). When a
// dedicated worker process runs build/worker.js, set WEB_DISABLE_WORKERS=true
// here so the same jobs aren't processed twice.
if (ENV.WEB_DISABLE_WORKERS) {
  logger.info(
    'WEB_DISABLE_WORKERS=true — background workers run in a dedicated process',
  );
} else {
  startWorkers().catch((err: unknown) => {
    logger.error({ err }, '❌ Failed to start background workers');
  });
}

let shuttingDown = false;

/**
 * Coordinated graceful shutdown: stop accepting new HTTP connections and drain
 * in-flight requests, close the workers (waits for in-flight jobs), then close
 * the DB pool. A hard timeout forces exit so a stuck request can't hang the
 * deploy.
 */
const shutdown = async (signal: string): Promise<void> => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`${signal} received, shutting down gracefully...`);

  const forceExit = setTimeout(() => {
    logger.error('Graceful shutdown timed out; forcing exit');
    process.exit(1);
  }, 35_000);
  forceExit.unref();

  try {
    await new Promise<void>((resolve) => {
      server.close(() => {
        resolve();
      });
    });
    // Closes every BullMQ worker and queue, which also closes their Redis
    // connections (the web process holds no other Redis clients).
    await stopWorkers();
    await prisma.$disconnect();
    logger.info('Shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error(error, 'Error during shutdown');
    process.exit(1);
  }
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

// A rejection with no catch handler would otherwise terminate the process
// silently. Log it with context; do not exit (the process may still be healthy).
process.on('unhandledRejection', (reason) => {
  logger.error(reason, 'Unhandled promise rejection');
});

// An uncaught exception leaves the process in an undefined state — log it and
// shut down cleanly rather than continuing to serve traffic.
process.on('uncaughtException', (error) => {
  // Dev-only noise: under `tsx --watch`, Node reports lazily-`require()`d
  // modules to the watch parent over IPC. If that channel has already closed
  // (a reload race), `process.send` throws ERR_IPC_CHANNEL_CLOSED mid-request.
  if ((error as NodeJS.ErrnoException).code === 'ERR_IPC_CHANNEL_CLOSED') {
    logger.warn('Ignoring watch-mode ERR_IPC_CHANNEL_CLOSED (dev-only)');
    return;
  }

  logger.fatal(error, 'Uncaught exception');
  void shutdown('uncaughtException');
});
