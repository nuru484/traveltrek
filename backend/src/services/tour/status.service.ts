// src/services/tour/status.service.ts
//
// Tour lifecycle mutations: the status state machine (UPCOMING → ONGOING /
// CANCELLED, ONGOING → COMPLETED, CANCELLED → UPCOMING — with the
// bookingless/payment guards and the cancel cascade) and delete (date/status/
// booking guards, soft delete, photo cleanup).
import {
  BookingStatus,
  PaymentStatus,
  type Prisma,
  TourStatus,
} from '#config/prismaClient.js';
import { BadRequestError, NotFoundError } from '#middlewares/error-handler.js';
import { type TourCore } from '#services/tour/core.js';
import { type TourActor, type TourDeps } from '#services/tour/shared.js';
import { tourInclude } from '#utils/mappers/tour.mapper.js';

export const makeTourStatusService = (d: TourDeps, core: TourCore) => {
  const { clock, logger, prisma } = d;
  const { cleanupPhoto } = core;

  /**
   * Status state machine. Allowed transitions (everything else is refused):
   * UPCOMING → ONGOING (start date reached, no pending payments),
   * UPCOMING → CANCELLED (no completed payments),
   * ONGOING  → COMPLETED (end date reached; endDate snapped to now),
   * CANCELLED → UPCOMING (start date still in the future).
   * Cancelling also cancels the tour's pending/confirmed bookings.
   */
  const updateTourStatus = async (
    actor: TourActor,
    id: number,
    newStatus: TourStatus,
  ) => {
    const tour = await prisma.tour.findFirst({
      include: { bookings: { include: { payment: true } } },
      where: { id },
    });
    if (!tour) throw new NotFoundError('Tour not found');

    const current = tour.status;
    if (newStatus === current) {
      throw new BadRequestError('New status is identical to current status');
    }

    const now = clock.now();
    let allow = false;
    const data: Prisma.TourUpdateInput = { status: newStatus };

    if (current === TourStatus.UPCOMING) {
      if (newStatus === TourStatus.ONGOING) {
        if (tour.startDate > now) {
          throw new BadRequestError('Cannot start tour before its start date');
        }
        const pendingPayments = tour.bookings.some(
          (b) => b.payment?.status === PaymentStatus.PENDING,
        );
        if (pendingPayments) {
          throw new BadRequestError('Cannot start tour with pending payments');
        }
        allow = true;
      } else if (newStatus === TourStatus.CANCELLED) {
        const paidBookings = tour.bookings.some(
          (b) => b.payment?.status === PaymentStatus.COMPLETED,
        );
        if (paidBookings) {
          throw new BadRequestError(
            'Cannot cancel tour with completed payments',
          );
        }
        allow = true;
      }
    } else if (current === TourStatus.ONGOING) {
      if (newStatus === TourStatus.COMPLETED) {
        if (tour.endDate > now) {
          throw new BadRequestError('Cannot complete tour before its end date');
        }
        data.endDate = now;
        allow = true;
      } else if (newStatus === TourStatus.CANCELLED) {
        throw new BadRequestError('Cannot cancel an ongoing tour');
      }
    } else if (current === TourStatus.COMPLETED) {
      if (newStatus === TourStatus.CANCELLED) {
        throw new BadRequestError('Cannot cancel a completed tour');
      }
    } else {
      // current === CANCELLED
      if (newStatus === TourStatus.UPCOMING) {
        if (tour.startDate <= now) {
          throw new BadRequestError(
            'Cannot reactivate tour - start date has passed',
          );
        }
        allow = true;
      }
    }

    if (!allow) {
      throw new BadRequestError(
        `Invalid status transition from ${current} to ${newStatus}`,
      );
    }

    const updated = await prisma.tour.update({
      data,
      include: tourInclude,
      where: { id },
    });

    if (newStatus === TourStatus.CANCELLED) {
      await prisma.booking.updateMany({
        data: { status: BookingStatus.CANCELLED },
        where: {
          // updateMany is not auto-scoped; leave soft-deleted rows untouched.
          deletedAt: null,
          status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
          tourId: id,
        },
      });
    }

    logger.info(
      `Tour ${tour.name} (${id}) status changed from ${current} to ${newStatus} by ${actor.role} ${actor.id}`,
    );

    return updated;
  };

  const deleteTour = async (id: number): Promise<void> => {
    const tour = await prisma.tour.findFirst({
      include: { bookings: { select: { id: true } } },
      where: { id },
    });
    if (!tour) throw new NotFoundError('Tour not found');

    const now = clock.now();
    if (tour.startDate <= now) {
      throw new BadRequestError('Cannot delete tour that has already started');
    }
    if (tour.endDate <= now) {
      throw new BadRequestError('Cannot delete tour that has already ended');
    }
    if (tour.status === TourStatus.ONGOING) {
      throw new BadRequestError('Cannot delete tour with status "ONGOING"');
    }
    if (tour.status === TourStatus.COMPLETED) {
      throw new BadRequestError('Cannot delete tour with status "COMPLETED"');
    }
    if (tour.bookings.length > 0) {
      throw new BadRequestError(
        'Cannot delete tour with existing bookings. Please cancel or reassign bookings first.',
      );
    }
    if (tour.guestsBooked > 0) {
      throw new BadRequestError(
        `Cannot delete tour with ${tour.guestsBooked} booked guest(s). Please cancel all bookings first.`,
      );
    }

    // Soft delete: the row survives (deletedAt set); scoped reads hide it.
    await prisma.tour.update({
      data: { deletedAt: clock.now() },
      where: { id },
    });

    if (tour.photo) {
      await cleanupPhoto(
        tour.photo,
        'Failed to clean up tour photo from Cloudinary',
      );
    }
  };

  return { deleteTour, updateTourStatus };
};
