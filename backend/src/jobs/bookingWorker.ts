// src/jobs/bookingWorker.ts
import { Worker } from 'bullmq';
import pMap from 'p-map';

import prisma from '#config/prismaClient.js';
import { createRedisConnection } from '#config/redisConnection.js';
import logger from '#utils/logger.js';

export const bookingDeadlineWorker = new Worker(
  'bookingDeadlineQueue',
  async (_job) => {
    logger.info('🔍 Checking for expired booking payment deadlines...');

    const now = new Date();

    const expiredBookings = await prisma.booking.findMany({
      include: {
        flight: true,
        room: {
          include: {
            hotel: true,
          },
        },
        tour: true,
        user: true,
      },
      where: {
        paymentDeadline: {
          lte: now,
        },
        status: 'PENDING',
      },
    });

    if (expiredBookings.length === 0) {
      logger.info('✅ No expired bookings found.');
      return { cancelledCount: 0 };
    }

    logger.info(
      `⚠️  Found ${expiredBookings.length} bookings with expired payment deadlines.`,
    );

    let cancelledCount = 0;
    let failureCount = 0;

    // Process bookings in batches with concurrency limit
    await pMap(
      expiredBookings,
      async (booking) => {
        try {
          await prisma.booking.update({
            data: { status: 'CANCELLED' },
            where: { id: booking.id },
          });

          if (booking.tourId && booking.tour) {
            await prisma.tour.update({
              data: {
                guestsBooked: {
                  decrement: booking.numberOfGuests,
                },
              },
              where: { id: booking.tourId },
            });
          }

          if (booking.flightId && booking.flight) {
            await prisma.flight.update({
              data: {
                seatsAvailable: {
                  increment: booking.numberOfGuests,
                },
              },
              where: { id: booking.flightId },
            });
          }

          cancelledCount++;
          logger.info(
            `❌ Cancelled booking #${booking.id} for user ${booking.user.email ?? `#${booking.userId}`}`,
          );
        } catch (err) {
          failureCount++;
          logger.error(
            `⚠️  Failed to cancel booking #${booking.id}: ${String(err)}`,
          );
        }
      },
      { concurrency: 10 },
    );

    logger.info(
      `✅ Booking deadline check completed. Cancelled: ${cancelledCount}, Failures: ${failureCount}`,
    );

    return { cancelledCount, failureCount };
  },
  {
    connection: createRedisConnection(),
  },
);

bookingDeadlineWorker.on('failed', (job, err) => {
  logger.error(`❌ Booking deadline job ${job?.id} failed: ${err.message}`);
});

bookingDeadlineWorker.on('completed', (job) => {
  logger.info(`✅ Booking deadline job ${job.id} completed successfully.`);
});
