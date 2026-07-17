// src/services/tour/query.service.ts
//
// Tour read paths: fetch one, the authed filtered/sorted listing, and the
// public (unauthenticated) bookable-inventory listing. The authed listing's
// where-clause is built by the tour core.
import { type Prisma, TourStatus } from '#config/prismaClient.js';
import { NotFoundError } from '#middlewares/error-handler.js';
import { type TourCore } from '#services/tour/core.js';
import {
  type PublicTourListParams,
  type TourDeps,
  type TourListParams,
} from '#services/tour/shared.js';
import { tourInclude } from '#utils/mappers/tour.mapper.js';

export const makeTourQueryService = (d: TourDeps, core: TourCore) => {
  const { prisma } = d;
  const { buildWhere } = core;

  // findFirst so soft-deleted tours 404 like hard-deleted ones did.
  const getTourById = async (id: number) => {
    const tour = await prisma.tour.findFirst({
      include: tourInclude,
      where: { id },
    });
    if (!tour) throw new NotFoundError('Tour not found');
    return tour;
  };

  /**
   * Public (unauthenticated) browse listing: bookable inventory only —
   * UPCOMING or ONGOING tours, soonest start first. Modest filters (search,
   * type, destination); everything else stays on the authed listing.
   */
  const listPublicTours = async (params: PublicTourListParams) => {
    const where: Prisma.TourWhereInput = {
      status: { in: [TourStatus.ONGOING, TourStatus.UPCOMING] },
    };
    if (params.type) where.type = params.type;
    if (params.destinationId !== undefined) {
      where.destinationId = params.destinationId;
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

    const [tours, total] = await Promise.all([
      prisma.tour.findMany({
        include: tourInclude,
        orderBy: { startDate: 'asc' },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        where,
      }),
      prisma.tour.count({ where }),
    ]);

    return { total, tours };
  };

  const listTours = async (params: TourListParams) => {
    const where = buildWhere(params);
    const orderBy: Prisma.TourOrderByWithRelationInput = {
      [params.sortBy]: params.sortOrder,
    };

    const [tours, total] = await Promise.all([
      prisma.tour.findMany({
        include: tourInclude,
        orderBy,
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        where,
      }),
      prisma.tour.count({ where }),
    ]);

    return { total, tours };
  };

  return { getTourById, listPublicTours, listTours };
};
