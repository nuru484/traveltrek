// src/jobs/tourWorker.ts
import { Worker } from 'bullmq';
import pMap from 'p-map';

import { TourStatus } from '../../generated/prisma/client';
import prisma from '../config/prismaClient';
import { createRedisConnection } from '../config/redisConnection';
import logger from '../utils/logger';

export const tourStatusWorker = new Worker(
  'tourStatusQueue',
  async (_job) => {
    logger.info('🗺️  Checking and updating tour statuses...');

    const now = new Date();

    const tours = await prisma.tour.findMany({
      where: {
        status: {
          in: ['UPCOMING', 'ONGOING'],
        },
      },
    });

    if (tours.length === 0) {
      logger.info('✅ No tours to update.');
      return { updatedCount: 0 };
    }

    logger.info(`🔍 Found ${tours.length} tours to check.`);

    let updatedCount = 0;
    let failureCount = 0;

    await pMap(
      tours,
      async (tour) => {
        try {
          let newStatus: null | TourStatus = null;

          if (now >= tour.endDate) {
            // Tour has ended
            if (tour.status !== 'CANCELLED') {
              newStatus = 'COMPLETED';
            }
          } else if (now >= tour.startDate && now < tour.endDate) {
            // Tour is ongoing
            if (tour.status !== 'CANCELLED') {
              newStatus = 'ONGOING';
            }
          } else if (now < tour.startDate) {
            if (tour.status === 'ONGOING' || tour.status === 'COMPLETED') {
              newStatus = 'UPCOMING';
            }
          }

          // Update if status has changed
          if (newStatus && newStatus !== tour.status) {
            await prisma.tour.update({
              data: { status: newStatus },
              where: { id: tour.id },
            });

            updatedCount++;
            logger.info(
              `🗺️  Updated tour "${tour.name}": ${tour.status} → ${newStatus}`,
            );
          }
        } catch (err) {
          failureCount++;
          logger.error(
            `⚠️  Failed to update tour ${tour.name}: ${String(err)}`,
          );
        }
      },
      { concurrency: 10 },
    );

    logger.info(
      `✅ Tour status update completed. Updated: ${updatedCount}, Failures: ${failureCount}`,
    );

    return { failureCount, updatedCount };
  },
  {
    connection: createRedisConnection(),
  },
);

tourStatusWorker.on('failed', (job, err) => {
  logger.error(`❌ Tour status job ${job?.id} failed: ${err.message}`);
});

tourStatusWorker.on('completed', (job) => {
  logger.info(`✅ Tour status job ${job.id} completed successfully.`);
});
