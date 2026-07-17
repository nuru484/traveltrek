// src/services/tour/update.service.ts
//
// Tour update: the date / capacity / destination-change guards (a tour already
// started or ended can't be edited), the write with derived duration, and the
// photo replace/remove cleanup. updateTour wraps the guarded body so a refused
// update reclaims a freshly uploaded photo.
import { BadRequestError, NotFoundError } from '#middlewares/error-handler.js';
import { type TourCore } from '#services/tour/core.js';
import {
  durationInDays,
  type TourDeps,
  type TourInput,
} from '#services/tour/shared.js';
import { tourInclude } from '#utils/mappers/tour.mapper.js';
import { photoColumnValue } from '#utils/photo-removal.js';

export const makeTourUpdateService = (d: TourDeps, core: TourCore) => {
  const { clock, prisma } = d;
  const { cleanupPhoto, requireDestination } = core;

  const updateTourGuarded = async (id: number, input: Partial<TourInput>) => {
    const existing = await prisma.tour.findFirst({
      include: {
        bookings: { select: { id: true } },
        destination: { select: { id: true } },
      },
      where: { id },
    });
    if (!existing) throw new NotFoundError('Tour not found');

    const now = clock.now();
    if (existing.startDate <= now) {
      throw new BadRequestError('Cannot update tour that has already started');
    }
    if (existing.endDate <= now) {
      throw new BadRequestError('Cannot update tour that has already ended');
    }
    if (input.startDate && input.startDate <= now) {
      throw new BadRequestError('Start date must be in the future');
    }
    if (input.endDate && input.endDate <= now) {
      throw new BadRequestError('End date must be in the future');
    }

    const newStartDate = input.startDate ?? existing.startDate;
    const newEndDate = input.endDate ?? existing.endDate;
    if (newEndDate <= newStartDate) {
      throw new BadRequestError('End date must be after start date');
    }

    if (input.destinationId !== undefined) {
      await requireDestination(input.destinationId);
      const hasBookings = existing.bookings.length > 0;
      if (hasBookings && input.destinationId !== existing.destination.id) {
        throw new BadRequestError(
          'Cannot change tour destination when bookings exist. Please cancel all bookings first or create a new tour.',
        );
      }
    }

    if (
      input.maxGuests !== undefined &&
      input.maxGuests < existing.guestsBooked
    ) {
      throw new BadRequestError(
        `Cannot reduce max guests to ${input.maxGuests}. ${existing.guestsBooked} guests are already booked. Minimum capacity allowed is ${existing.guestsBooked}.`,
      );
    }

    // Duration is derived, never client-supplied: recompute when either date
    // moves, leave untouched otherwise.
    const duration =
      input.startDate !== undefined || input.endDate !== undefined
        ? durationInDays(newStartDate, newEndDate)
        : undefined;

    const updated = await prisma.tour.update({
      data: {
        description: input.description,
        destinationId: input.destinationId,
        duration,
        endDate: input.endDate,
        maxGuests: input.maxGuests,
        name: input.name,
        photo: photoColumnValue(input.photo),
        price: input.price,
        startDate: input.startDate,
        type: input.type,
      },
      include: tourInclude,
      where: { id },
    });

    // Replaced or removed photo: drop the old image now that the row no
    // longer points at it ('' — the removal signal — is covered too).
    if (
      input.photo !== undefined &&
      existing.photo &&
      existing.photo !== input.photo
    ) {
      await cleanupPhoto(existing.photo, 'Failed to clean up old tour photo');
    }

    return updated;
  };

  const updateTour = async (id: number, input: Partial<TourInput>) => {
    const uploadedPhotoUrl = input.photo;

    try {
      return await updateTourGuarded(id, input);
    } catch (error) {
      // Cloudinary upload succeeded but the update was refused: clean up the
      // freshly uploaded image before rethrowing.
      if (uploadedPhotoUrl) {
        await cleanupPhoto(
          uploadedPhotoUrl,
          'Failed to clean up Cloudinary image',
        );
      }
      throw error;
    }
  };

  return { updateTour };
};
