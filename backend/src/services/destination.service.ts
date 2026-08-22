// src/services/destination.service.ts
//
// Destinations domain logic. Pure, DI'd functions: they take typed inputs,
// own every Prisma access and domain invariant (name uniqueness, dependency
// guards, Cloudinary photo cleanup), throw the typed CustomError subclasses
// and never touch req/res.
//
// Role enforcement note: no handler here re-checks req.user.role.
// routes/destination.ts enforces the ADMIN/AGENT gates via authorizeRole,
// which is the single authorization boundary.
import type { Prisma } from '#config/prismaClient.js';

import {
  BadRequestError,
  NotFoundError,
} from '#middlewares/error-handler.js';
import { type AppDeps, defaultDeps } from '#services/deps.js';
import { photoColumnValue } from '#utils/photo-removal.js';

/** Whitelisted `sortBy` fields for destination listings (all scalar). */
export const DESTINATION_SORT_FIELDS = [
  'city',
  'country',
  'createdAt',
  'name',
  'updatedAt',
] as const;

export interface DestinationInput {
  city?: string;
  country: string;
  description?: string;
  name: string;
  /** Cloudinary URL, already uploaded by the route's middleware. */
  photo?: string;
}

export interface DestinationListParams {
  city?: string;
  country?: string;
  limit: number;
  page: number;
  search?: string;
  sortBy: DestinationSortField;
  sortOrder: 'asc' | 'desc';
}

export type DestinationSortField = (typeof DESTINATION_SORT_FIELDS)[number];

export type DestinationUpdateInput = Partial<DestinationInput>;

/**
 * Narrow relation counts used by the delete guards. Nested reads are not
 * scoped by the soft-delete extension, so each carries an explicit
 * `deletedAt: null`, so soft-deleted dependents never block a delete.
 */
const dependencyInclude = {
  destinationFlights: { select: { id: true }, where: { deletedAt: null } },
  hotels: { select: { id: true }, where: { deletedAt: null } },
  originFlights: { select: { id: true }, where: { deletedAt: null } },
  tours: { select: { id: true }, where: { deletedAt: null } },
} satisfies Prisma.DestinationInclude;

type DestinationWithDependencies = Prisma.DestinationGetPayload<{
  include: typeof dependencyInclude;
}>;

/** Names of the relation groups that block a delete (Hotels, Tours, Flights). */
const blockingDependencies = (
  destination: DestinationWithDependencies,
): string[] => {
  const dependentItems: string[] = [];
  if (destination.hotels.length > 0) dependentItems.push('Hotels');
  if (destination.tours.length > 0) dependentItems.push('Tours');
  if (
    destination.originFlights.length > 0 ||
    destination.destinationFlights.length > 0
  ) {
    dependentItems.push('Flights');
  }
  return dependentItems;
};

export const makeDestinationService = (
  d: Pick<AppDeps, 'clock' | 'cloudinary' | 'logger' | 'prisma'>,
) => {
  const { clock, cloudinary, logger, prisma } = d;

  /**
   * Case-insensitive uniqueness guard for name + country (+ city when one is
   * in play). `excludeId` skips the row being updated.
   */
  const assertNameAvailable = async (
    name: string,
    country: string,
    city: null | string | undefined,
    excludeId?: number,
  ): Promise<void> => {
    const existing = await prisma.destination.findFirst({
      select: { id: true },
      where: {
        city: city ? { equals: city, mode: 'insensitive' } : undefined,
        country: { equals: country, mode: 'insensitive' },
        ...(excludeId !== undefined && { id: { not: excludeId } }),
        name: { equals: name, mode: 'insensitive' },
      },
    });
    if (existing) {
      throw new BadRequestError(
        'A destination with this name already exists in the specified country/city',
      );
    }
  };

  /** Best-effort Cloudinary delete; a cleanup failure never fails the request. */
  const cleanupPhoto = async (photo: string, context: string): Promise<void> => {
    try {
      await cloudinary.deleteImage(photo);
    } catch (cleanupError) {
      logger.warn({ err: cleanupError, photo }, context);
    }
  };

  // findFirst so soft-deleted destinations 404 like hard-deleted ones did.
  const getDestinationById = async (id: number) => {
    const destination = await prisma.destination.findFirst({ where: { id } });
    if (!destination) throw new NotFoundError('Destination not found');
    return destination;
  };

  const createDestination = async (input: DestinationInput) => {
    try {
      await assertNameAvailable(input.name, input.country, input.city);

      return await prisma.destination.create({
        data: {
          city: input.city,
          country: input.country,
          description: input.description,
          name: input.name,
          photo: input.photo ?? null,
        },
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

  const updateDestination = async (
    id: number,
    input: DestinationUpdateInput,
  ) => {
    const uploadedPhotoUrl = input.photo;

    try {
      // The at-least-one-field check lives here because the photo may arrive
      // as a multer file that zod (body-only) cannot see.
      if (
        !input.name &&
        !input.description &&
        !input.country &&
        !input.city &&
        input.photo === undefined
      ) {
        throw new BadRequestError(
          'At least one field must be provided for update',
        );
      }

      if (input.name) {
        // Compare against the stored country/city when the update omits them.
        const current = await prisma.destination.findFirst({
          select: { city: true, country: true },
          where: { id },
        });
        if (current) {
          await assertNameAvailable(
            input.name,
            input.country ?? current.country,
            input.city ?? current.city,
            id,
          );
        }
      }

      const existing = await prisma.destination.findFirst({
        select: { photo: true },
        where: { id },
      });
      if (!existing) throw new NotFoundError('Destination not found');

      const updated = await prisma.destination.update({
        data: {
          city: input.city,
          country: input.country,
          description: input.description,
          name: input.name,
          photo: photoColumnValue(uploadedPhotoUrl),
        },
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
          'Failed to clean up old destination photo',
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

  const deleteDestination = async (id: number): Promise<void> => {
    const destination = await prisma.destination.findFirst({
      include: dependencyInclude,
      where: { id },
    });
    if (!destination) throw new NotFoundError('Destination not found');

    const dependentItems = blockingDependencies(destination);
    if (dependentItems.length > 0) {
      throw new BadRequestError(
        `This destination cannot be deleted because it has associated: ${dependentItems.join(
          ', ',
        )}. Please remove or reassign them before deleting the destination.`,
      );
    }

    // Soft delete: the row survives (deletedAt set); scoped reads hide it.
    await prisma.destination.update({
      data: { deletedAt: clock.now() },
      where: { id },
    });

    if (destination.photo) {
      await cleanupPhoto(
        destination.photo,
        'Failed to clean up destination photo from Cloudinary',
      );
    }
  };

  const buildWhere = (
    params: DestinationListParams,
  ): Prisma.DestinationWhereInput => {
    const where: Prisma.DestinationWhereInput = {};

    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { description: { contains: params.search, mode: 'insensitive' } },
        { country: { contains: params.search, mode: 'insensitive' } },
        { city: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    if (params.country) {
      where.country = { contains: params.country, mode: 'insensitive' };
    }
    if (params.city) {
      where.city = { contains: params.city, mode: 'insensitive' };
    }

    return where;
  };

  const listDestinations = async (params: DestinationListParams) => {
    const where = buildWhere(params);
    const orderBy: Prisma.DestinationOrderByWithRelationInput = {
      [params.sortBy]: params.sortOrder,
    };

    const [destinations, total] = await Promise.all([
      prisma.destination.findMany({
        orderBy,
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        where,
      }),
      prisma.destination.count({ where }),
    ]);

    return { destinations, total };
  };

  return {
    createDestination,
    deleteDestination,
    getDestinationById,
    listDestinations,
    updateDestination,
  };
};

export const destinationService = makeDestinationService(defaultDeps);

export const {
  createDestination,
  deleteDestination,
  getDestinationById,
  listDestinations,
  updateDestination,
} = destinationService;
