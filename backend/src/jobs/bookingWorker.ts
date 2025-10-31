// src/jobs/bookingWorker.ts
import { Worker } from 'bullmq';
import prisma from '../config/prismaClient';
import pMap from 'p-map';
import { createRedisConnection } from '../config/redisConnection';
import logger from '../utils/logger';

export const bookingDeadlineWorker = new Worker(
  'bookingDeadlineQueue',
  async (job) => {
    logger.info('🔍 Checking for expired booking payment deadlines...');

    const now = new Date();

    const expiredBookings = await prisma.booking.findMany({
      where: {
        status: 'PENDING',
        paymentDeadline: {
          lte: now,
        },
      },
      include: {
        user: true,
        tour: true,
        room: {
          include: {
            hotel: true,
          },
        },
        flight: true,
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
            where: { id: booking.id },
            data: { status: 'CANCELLED' },
          });

          if (booking.tourId && booking.tour) {
            await prisma.tour.update({
              where: { id: booking.tourId },
              data: {
                guestsBooked: {
                  decrement: booking.numberOfGuests,
                },
              },
            });
          }

          if (booking.flightId && booking.flight) {
            await prisma.flight.update({
              where: { id: booking.flightId },
              data: {
                seatsAvailable: {
                  increment: booking.numberOfGuests,
                },
              },
            });
          }

          cancelledCount++;
          logger.info(
            `❌ Cancelled booking #${booking.id} for user ${booking.user.email}`,
          );
        } catch (err) {
          failureCount++;
          logger.error(`⚠️  Failed to cancel booking #${booking.id}: ${err}`);
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
