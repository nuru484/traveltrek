// src/services/tour/core.ts
//
// The shared tours engine: best-effort photo cleanup, the destination
// existence guard, and the list where-clause builder. Built once per deps.
import { type Prisma } from '#config/prismaClient.js';
import { NotFoundError } from '#middlewares/error-handler.js';
import {
  type TourDeps,
  type TourListParams,
} from '#services/tour/shared.js';

export type TourCore = ReturnType<typeof makeTourCore>;

export const makeTourCore = (d: TourDeps) => {
  const { cloudinary, logger, prisma } = d;

  /** Best-effort Cloudinary delete; a cleanup failure never fails the request. */
  const cleanupPhoto = async (
    photo: string,
    context: string,
  ): Promise<void> => {
    try {
      await cloudinary.deleteImage(photo);
    } catch (cleanupError) {
      logger.warn({ err: cleanupError, photo }, context);
    }
  };

  // findFirst (not findUnique) so the soft-delete extension scopes the read:
  // a soft-deleted destination cannot host new tours.
  const requireDestination = async (id: number): Promise<void> => {
    const destination = await prisma.destination.findFirst({
      select: { id: true },
      where: { id },
    });
    if (!destination) throw new NotFoundError('Destination not found');
  };

  const buildWhere = (params: TourListParams): Prisma.TourWhereInput => {
    const where: Prisma.TourWhereInput = {};

    if (params.type) where.type = params.type;
    if (params.status) where.status = params.status;

    if (params.destinationId !== undefined || params.country || params.city) {
      where.destination = {
        ...(params.destinationId !== undefined && { id: params.destinationId }),
        ...(params.country && {
          country: { contains: params.country, mode: 'insensitive' },
        }),
        ...(params.city && {
          city: { contains: params.city, mode: 'insensitive' },
        }),
      };
    }

    if (params.minPrice !== undefined || params.maxPrice !== undefined) {
      where.price = {
        ...(params.minPrice !== undefined && { gte: params.minPrice }),
        ...(params.maxPrice !== undefined && { lte: params.maxPrice }),
      };
    }

    if (params.minDuration !== undefined || params.maxDuration !== undefined) {
      where.duration = {
        ...(params.minDuration !== undefined && { gte: params.minDuration }),
        ...(params.maxDuration !== undefined && { lte: params.maxDuration }),
      };
    }

    // Guest bounds filter the tour's capacity column, not current occupancy.
    if (params.minGuests !== undefined || params.maxGuests !== undefined) {
      where.maxGuests = {
        ...(params.minGuests !== undefined && { gte: params.minGuests }),
        ...(params.maxGuests !== undefined && { lte: params.maxGuests }),
      };
    }

    if (params.startDate) where.startDate = { gte: params.startDate };
    if (params.endDate) where.endDate = { lte: params.endDate };

    // Column-to-column comparison: tours with at least one seat left.
    if (params.availableOnly) {
      where.guestsBooked = { lt: prisma.tour.fields.maxGuests };
    }

    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { description: { contains: params.search, mode: 'insensitive' } },
        {
          destination: {
            name: { contains: params.search, mode: 'insensitive' },
          },
        },
      ];
    }

    return where;
  };

  return { buildWhere, cleanupPhoto, requireDestination };
};
