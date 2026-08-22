// src/services/hotel.service.ts
//
// Hotels domain logic. Pure, DI'd functions: they take typed inputs, own
// every Prisma access and domain invariant (destination existence,
// delete-with-rooms guards, Cloudinary photo cleanup), throw the typed
// CustomError subclasses and never touch req/res.
import { type Prisma } from '#config/prismaClient.js';
import {
  BadRequestError,
  NotFoundError,
} from '#middlewares/error-handler.js';
import { type AppDeps, defaultDeps } from '#services/deps.js';
import { hotelInclude } from '#utils/mappers/hotel.mapper.js';
import { photoColumnValue } from '#utils/photo-removal.js';

/**
 * Whitelisted `sortBy` fields for hotel listings. `city` and `country` live
 * on the related destination and sort through the relation, not a flat
 * orderBy on the hotel row.
 */
export const HOTEL_SORT_FIELDS = [
  'city',
  'country',
  'createdAt',
  'name',
  'starRating',
  'updatedAt',
] as const;

/** Sort fields that live on the related destination, not the hotel row. */
const DESTINATION_SORT_FIELDS: readonly HotelSortField[] = ['city', 'country'];

export interface HotelInput {
  address: string;
  amenities?: string[];
  description?: string;
  destinationId: number;
  name: string;
  phone?: string;
  /** Cloudinary URL, already uploaded by the route's middleware. */
  photo?: string;
  starRating?: number;
}

export interface HotelListParams {
  /** Hotels offering every one of these amenities. */
  amenities?: string[];
  city?: string;
  country?: string;
  destinationId?: number;
  limit: number;
  maxStarRating?: number;
  minStarRating?: number;
  page: number;
  search?: string;
  sortBy: HotelSortField;
  sortOrder: 'asc' | 'desc';
  starRating?: number;
}

export type HotelSortField = (typeof HOTEL_SORT_FIELDS)[number];

export type HotelUpdateInput = Partial<HotelInput>;

export const makeHotelService = (
  d: Pick<AppDeps, 'clock' | 'cloudinary' | 'logger' | 'prisma'>,
) => {
  const { clock, cloudinary, logger, prisma } = d;

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
  // a soft-deleted destination cannot host new hotels.
  const requireDestination = async (id: number): Promise<void> => {
    const destination = await prisma.destination.findFirst({
      select: { id: true },
      where: { id },
    });
    if (!destination) throw new NotFoundError('Destination not found');
  };

  // findFirst so soft-deleted hotels 404 like hard-deleted ones did.
  const getHotelById = async (id: number) => {
    const hotel = await prisma.hotel.findFirst({
      include: hotelInclude,
      where: { id },
    });
    if (!hotel) throw new NotFoundError('Hotel not found');
    return hotel;
  };

  const createHotel = async (input: HotelInput) => {
    try {
      await requireDestination(input.destinationId);

      return await prisma.hotel.create({
        data: {
          address: input.address,
          amenities: input.amenities ?? [],
          description: input.description,
          destination: { connect: { id: input.destinationId } },
          name: input.name,
          phone: input.phone,
          photo: input.photo ?? null,
          starRating: input.starRating ?? 3,
        },
        include: hotelInclude,
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

  const updateHotel = async (id: number, input: HotelUpdateInput) => {
    const uploadedPhotoUrl = input.photo;

    try {
      const existing = await prisma.hotel.findFirst({
        select: { photo: true },
        where: { id },
      });
      if (!existing) throw new NotFoundError('Hotel not found');

      if (input.destinationId !== undefined) {
        await requireDestination(input.destinationId);
      }

      // Prisma ignores undefined keys, so omitted fields stay untouched.
      const updated = await prisma.hotel.update({
        data: {
          address: input.address,
          amenities: input.amenities,
          description: input.description,
          destinationId: input.destinationId,
          name: input.name,
          phone: input.phone,
          photo: photoColumnValue(uploadedPhotoUrl),
          starRating: input.starRating,
        },
        include: hotelInclude,
        where: { id },
      });

      // Replaced or removed photo: drop the old image now that the row no
      // longer points at it ('' — the removal signal — is covered too).
      if (
        uploadedPhotoUrl !== undefined &&
        existing.photo &&
        existing.photo !== uploadedPhotoUrl
      ) {
        await cleanupPhoto(
          existing.photo,
          'Failed to clean up old hotel photo',
        );
      }

      return updated;
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

  const deleteHotel = async (id: number): Promise<void> => {
    // Nested reads are not auto-scoped: only active (non-deleted) rooms block.
    const hotel = await prisma.hotel.findFirst({
      include: { rooms: { select: { id: true }, where: { deletedAt: null } } },
      where: { id },
    });
    if (!hotel) throw new NotFoundError('Hotel not found');

    if (hotel.rooms.length > 0) {
      throw new BadRequestError(
        'Cannot delete hotel with existing rooms. Please remove rooms first.',
      );
    }

    // Soft delete: the row survives (deletedAt set); scoped reads hide it.
    await prisma.hotel.update({
      data: { deletedAt: clock.now() },
      where: { id },
    });

    if (hotel.photo) {
      await cleanupPhoto(
        hotel.photo,
        'Failed to clean up hotel photo from Cloudinary',
      );
    }
  };

  const buildWhere = (params: HotelListParams): Prisma.HotelWhereInput => {
    const where: Prisma.HotelWhereInput = {};

    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { description: { contains: params.search, mode: 'insensitive' } },
        { address: { contains: params.search, mode: 'insensitive' } },
        {
          destination: {
            city: { contains: params.search, mode: 'insensitive' },
          },
        },
        {
          destination: {
            country: { contains: params.search, mode: 'insensitive' },
          },
        },
      ];
    }

    if (params.destinationId !== undefined) {
      where.destinationId = params.destinationId;
    }

    if (params.city || params.country) {
      where.destination = {
        ...(params.city && {
          city: { contains: params.city, mode: 'insensitive' },
        }),
        ...(params.country && {
          country: { contains: params.country, mode: 'insensitive' },
        }),
      };
    }

    // Exact match first; a min/max bound replaces it.
    if (params.starRating !== undefined) where.starRating = params.starRating;
    if (
      params.minStarRating !== undefined ||
      params.maxStarRating !== undefined
    ) {
      where.starRating = {
        ...(params.minStarRating !== undefined && {
          gte: params.minStarRating,
        }),
        ...(params.maxStarRating !== undefined && {
          lte: params.maxStarRating,
        }),
      };
    }

    if (params.amenities && params.amenities.length > 0) {
      where.amenities = { hasEvery: params.amenities };
    }

    return where;
  };

  const listHotels = async (params: HotelListParams) => {
    const where = buildWhere(params);
    // city/country sort by the related destination's column.
    const orderBy: Prisma.HotelOrderByWithRelationInput =
      DESTINATION_SORT_FIELDS.includes(params.sortBy)
        ? { destination: { [params.sortBy]: params.sortOrder } }
        : { [params.sortBy]: params.sortOrder };

    const [hotels, total] = await Promise.all([
      prisma.hotel.findMany({
        include: hotelInclude,
        orderBy,
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        where,
      }),
      prisma.hotel.count({ where }),
    ]);

    return { hotels, total };
  };

  /** Newest-first page of a destination's hotels; 404s on a missing destination. */
  const listHotelsByDestination = async (
    destinationId: number,
    params: { limit: number; page: number },
  ) => {
    await requireDestination(destinationId);

    const where: Prisma.HotelWhereInput = { destinationId };
    const [hotels, total] = await Promise.all([
      prisma.hotel.findMany({
        include: hotelInclude,
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        where,
      }),
      prisma.hotel.count({ where }),
    ]);

    return { hotels, total };
  };

  return {
    createHotel,
    deleteHotel,
    getHotelById,
    listHotels,
    listHotelsByDestination,
    updateHotel,
  };
};

export const hotelService = makeHotelService(defaultDeps);

export const {
  createHotel,
  deleteHotel,
  getHotelById,
  listHotels,
  listHotelsByDestination,
  updateHotel,
} = hotelService;
