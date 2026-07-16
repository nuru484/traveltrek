// src/services/tour.service.ts
//
// Tours domain logic, extracted from the legacy fat controller. Pure, DI'd
// functions: they take typed inputs, own every Prisma access and domain
// invariant (date guards, capacity rules, status transitions, delete
// protections, Cloudinary photo cleanup), throw the typed CustomError
// subclasses and never touch req/res.
//
// Role enforcement note: the legacy handlers re-checked req.user.role inline
// (ADMIN/AGENT gates on delete and status updates). Those duplicates were
// deliberately dropped in this refactor — routes/tour.ts already enforces
// roles via authorizeRole, which is the single authorization boundary.
import type { IUser } from '#types/user-profile.types.js';

import {
  BookingStatus,
  PaymentStatus,
  type Prisma,
  TourStatus,
  type TourType,
} from '#config/prismaClient.js';
import {
  BadRequestError,
  NotFoundError,
} from '#middlewares/error-handler.js';
import { type AppDeps, defaultDeps } from '#services/deps.js';
import { tourInclude } from '#utils/mappers/tour.mapper.js';
import { photoColumnValue } from '#utils/photo-removal.js';

/** Whitelisted `sortBy` fields for tour listings (all indexed-or-scalar). */
export const TOUR_SORT_FIELDS = [
  'createdAt',
  'duration',
  'endDate',
  'guestsBooked',
  'maxGuests',
  'name',
  'price',
  'startDate',
  'updatedAt',
] as const;

/** Filters accepted by the public (unauthenticated) tour listing. */
export interface PublicTourListParams {
  destinationId?: number;
  limit: number;
  page: number;
  search?: string;
  type?: TourType;
}

/** Who performed a mutation, for the audit log line. */
export type TourActor = Pick<IUser, 'id' | 'role'>;

export interface TourInput {
  description?: string;
  destinationId: number;
  endDate: Date;
  maxGuests: number;
  name: string;
  /** Cloudinary URL, already uploaded by the route's middleware. */
  photo?: string;
  price: number;
  startDate: Date;
  type: TourType;
}

export interface TourListParams {
  /** Only tours with seats left (guestsBooked < maxGuests). */
  availableOnly?: boolean;
  city?: string;
  country?: string;
  destinationId?: number;
  /** Tours ending on or before this instant. */
  endDate?: Date;
  limit: number;
  maxDuration?: number;
  /** Bounds on the tour's guest capacity (the maxGuests column). */
  maxGuests?: number;
  maxPrice?: number;
  minDuration?: number;
  minGuests?: number;
  minPrice?: number;
  page: number;
  search?: string;
  sortBy: TourSortField;
  sortOrder: 'asc' | 'desc';
  /** Tours starting on or after this instant. */
  startDate?: Date;
  status?: TourStatus;
  type?: TourType;
}

export type TourSortField = (typeof TOUR_SORT_FIELDS)[number];

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** Whole days between two instants, partial days rounded up. */
const durationInDays = (start: Date, end: Date): number =>
  Math.ceil((end.getTime() - start.getTime()) / MS_PER_DAY);

export const makeTourService = (
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
  // a soft-deleted destination cannot host new tours.
  const requireDestination = async (id: number): Promise<void> => {
    const destination = await prisma.destination.findFirst({
      select: { id: true },
      where: { id },
    });
    if (!destination) throw new NotFoundError('Destination not found');
  };

  // findFirst so soft-deleted tours 404 like hard-deleted ones did.
  const getTourById = async (id: number) => {
    const tour = await prisma.tour.findFirst({
      include: tourInclude,
      where: { id },
    });
    if (!tour) throw new NotFoundError('Tour not found');
    return tour;
  };

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

  return {
    createTour,
    deleteTour,
    getTourById,
    listPublicTours,
    listTours,
    updateTour,
    updateTourStatus,
  };
};

export const tourService = makeTourService(defaultDeps);

export const {
  createTour,
  deleteTour,
  getTourById,
  listPublicTours,
  listTours,
  updateTour,
  updateTourStatus,
} = tourService;
