// src/services/tour/create.service.ts
//
// Tour creation: destination existence guard, then the insert (duration
// derived from the date range). A refused create reclaims the already-uploaded
// photo.
import { type TourCore } from '#services/tour/core.js';
import {
  durationInDays,
  type TourDeps,
  type TourInput,
} from '#services/tour/shared.js';
import { tourInclude } from '#utils/mappers/tour.mapper.js';

export const makeTourCreateService = (d: TourDeps, core: TourCore) => {
  const { prisma } = d;
  const { cleanupPhoto, requireDestination } = core;

  const createTour = async (input: TourInput) => {
    try {
      await requireDestination(input.destinationId);

      return await prisma.tour.create({
        data: {
          description: input.description,
          destinationId: input.destinationId,
          duration: durationInDays(input.startDate, input.endDate),
          endDate: input.endDate,
          maxGuests: input.maxGuests,
          name: input.name,
          photo: input.photo ?? null,
          price: input.price,
          startDate: input.startDate,
          type: input.type,
        },
        include: tourInclude,
      });
    } catch (error) {
      // The photo was already uploaded by the route middleware; don't orphan
      // it on Cloudinary when the create is refused.
      if (input.photo) {
        await cleanupPhoto(input.photo, 'Failed to clean up Cloudinary image');
      }
      throw error;
    }
  };

  return { createTour };
};
