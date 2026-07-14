// src/jobs/flightWorker.ts
import { Worker } from 'bullmq';
import prisma from '../config/prismaClient';
import pMap from 'p-map';
import { createRedisConnection } from '../config/redisConnection';
import { FlightStatus } from '../../generated/prisma/client';
import logger from '../utils/logger';

export const flightStatusWorker = new Worker(
  'flightStatusQueue',
  async (job) => {
    logger.info('✈️  Checking and updating flight statuses...');

    const now = new Date();

    const flights = await prisma.flight.findMany({
      where: {
        status: {
          in: ['SCHEDULED', 'DEPARTED', 'DELAYED'],
        },
      },
    });

    if (flights.length === 0) {
      logger.info('✅ No flights to update.');
      return { updatedCount: 0 };
    }

    logger.info(`🔍 Found ${flights.length} flights to check.`);

    let updatedCount = 0;
    let failureCount = 0;

    await pMap(
      flights,
      async (flight) => {
        try {
          let newStatus: FlightStatus | null = null;

          if (now >= flight.arrival) {
            // Flight has arrived
            if (flight.status !== 'CANCELLED') {
              newStatus = 'LANDED';
            }
          } else if (now >= flight.departure && now < flight.arrival) {
            // Flight is in the air
            if (flight.status !== 'CANCELLED') {
              newStatus = 'DEPARTED';
            }
          } else if (now < flight.departure) {
            if (flight.status === 'DEPARTED' || flight.status === 'LANDED') {
              newStatus = 'SCHEDULED';
            }
          }

          // Update if status has changed
          if (newStatus && newStatus !== flight.status) {
            await prisma.flight.update({
              where: { id: flight.id },
              data: { status: newStatus },
            });

            updatedCount++;
            console.log(
              `✈️  Updated flight ${flight.flightNumber}: ${flight.status} → ${newStatus}`,
            );
          }
        } catch (err) {
          failureCount++;
          logger.error(
            `⚠️  Failed to update flight ${flight.flightNumber}: ${err}`,
          );
        }
      },
      { concurrency: 10 },
    );

    logger.info(
      `✅ Flight status update completed. Updated: ${updatedCount}, Failures: ${failureCount}`,
    );

    return { updatedCount, failureCount };
  },
  {
    connection: createRedisConnection(),
  },
);

flightStatusWorker.on('failed', (job, err) => {
  logger.error(`❌ Flight status job ${job?.id} failed: ${err.message}`);
});

flightStatusWorker.on('completed', (job) => {
  logger.info(`✅ Flight status job ${job.id} completed successfully.`);
});
