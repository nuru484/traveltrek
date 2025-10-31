// src/jobs/tourWorker.ts
import { Worker } from 'bullmq';
import prisma from '../config/prismaClient';
import pMap from 'p-map';
import { createRedisConnection } from '../config/redisConnection';
import { TourStatus } from '../../generated/prisma/index';
import logger from '../utils/logger';

export const tourStatusWorker = new Worker(
  'tourStatusQueue',
  async (job) => {
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
          let newStatus: TourStatus | null = null;

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
              where: { id: tour.id },
              data: { status: newStatus },
            });

            updatedCount++;
            logger.info(
              `🗺️  Updated tour "${tour.name}": ${tour.status} → ${newStatus}`,
            );
          }
        } catch (err) {
          failureCount++;
          logger.error(`⚠️  Failed to update tour ${tour.name}: ${err}`);
        }
      },
      { concurrency: 10 },
    );

    logger.info(
      `✅ Tour status update completed. Updated: ${updatedCount}, Failures: ${failureCount}`,
    );

    return { updatedCount, failureCount };
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
