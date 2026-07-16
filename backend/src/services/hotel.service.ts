// src/services/hotel.service.ts
//
// Hotels domain logic, extracted from the legacy fat controller. Pure, DI'd
// functions: they take typed inputs, own every Prisma access and domain
// invariant (destination existence, delete-with-rooms guards, Cloudinary
// photo cleanup), throw the typed CustomError subclasses and never touch
// req/res.
//
// Role enforcement note: the legacy deleteAllHotels handler re-checked
// req.user.role inline (ADMIN gate). That duplicate was deliberately dropped
// in this refactor — routes/hotel.ts already enforces roles via
// authorizeRole, which is the single authorization boundary.
import { HTTP_STATUS_CODES } from '#config/constants.js';
import { type Prisma } from '#config/prismaClient.js';
import {
  BadRequestError,
  CustomError,
  NotFoundError,
} from '#middlewares/error-handler.js';
import { type AppDeps, defaultDeps } from '#services/deps.js';
import { hotelInclude } from '#utils/mappers/hotel.mapper.js';

/**
 * Whitelisted `sortBy` fields for hotel listings. `city` and `country` live
 * on the related destination and sort through it (the legacy controller
 * accepted them but crashed on the flat orderBy; here they work).
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
  d: Pick<AppDeps, 'cloudinary' | 'logger' | 'prisma'>,
) => {
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

  const requireDestination = async (id: number): Promise<void> => {
    const destination = await prisma.destination.findUnique({
      select: { id: true },
      where: { id },
    });
    if (!destination) throw new NotFoundError('Destination not found');
  };

  const getHotelById = async (id: number) => {
    const hotel = await prisma.hotel.findUnique({
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
      const existing = await prisma.hotel.findUnique({
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
          photo: uploadedPhotoUrl,
          starRating: input.starRating,
        },
        include: hotelInclude,
        where: { id },
      });

      // Replaced photo: drop the old image now that the row points elsewhere.
      if (
        uploadedPhotoUrl &&
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
    const hotel = await prisma.hotel.findUnique({
      include: { rooms: { select: { id: true } } },
      where: { id },
    });
    if (!hotel) throw new NotFoundError('Hotel not found');

    if (hotel.rooms.length > 0) {
      throw new BadRequestError(
        'Cannot delete hotel with existing rooms. Please remove rooms first.',
      );
    }

    await prisma.hotel.delete({ where: { id } });

    if (hotel.photo) {
      await cleanupPhoto(
        hotel.photo,
        'Failed to clean up hotel photo from Cloudinary',
      );
    }
  };

  /**
   * Wipes every hotel, but only when none of them still has rooms (reported
   * together in one 409). Returns the deleted count; an empty table is
   * refused as a 400, matching the legacy handler.
   */
  const deleteAllHotels = async (): Promise<number> => {
    const hotelCount = await prisma.hotel.count();
    if (hotelCount === 0) throw new BadRequestError('No hotels to delete');

    const hotels = await prisma.hotel.findMany({
      select: {
        id: true,
        name: true,
        photo: true,
        rooms: { select: { id: true } },
      },
    });

    const hotelsWithRooms = hotels.filter((hotel) => hotel.rooms.length > 0);
    if (hotelsWithRooms.length > 0) {
      throw new CustomError(
        HTTP_STATUS_CODES.CONFLICT,
        `Cannot delete all hotels: ${hotelsWithRooms.length} hotel${hotelsWithRooms.length > 1 ? 's' : ''} have rooms in it, it must be removed first`,
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.hotel.deleteMany({});
    });

    const photosToClean = hotels.flatMap((hotel) =>
      hotel.photo ? [{ ...hotel, photo: hotel.photo }] : [],
    );
    await Promise.allSettled(
      photosToClean.map((hotel) =>
        cleanupPhoto(
          hotel.photo,
          `Failed to clean up photo for hotel ${hotel.id} (${hotel.name})`,
        ),
      ),
    );

    return hotels.length;
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

    // Exact match first; a min/max bound replaces it, like the legacy filter.
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
    deleteAllHotels,
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
  deleteAllHotels,
  deleteHotel,
  getHotelById,
  listHotels,
  listHotelsByDestination,
  updateHotel,
} = hotelService;
