// src/services/tour.service.ts
//
// Tours domain logic, extracted from the legacy fat controller. Pure, DI'd
// functions: they take typed inputs, own every Prisma access and domain
// invariant (date guards, capacity rules, status transitions, delete
// protections), throw the typed CustomError subclasses and never touch
// req/res.
//
// Role enforcement note: the legacy handlers re-checked req.user.role inline
// (ADMIN/AGENT gates on delete and status updates). Those duplicates were
// deliberately dropped in this refactor — routes/tour.ts already enforces
// roles via authorizeRole, which is the single authorization boundary.
import type { IUser } from '../../types/user-profile.types';

import { HTTP_STATUS_CODES } from '../config/constants';
import {
  BookingStatus,
  PaymentStatus,
  type Prisma,
  TourStatus,
  type TourType,
} from '../config/prismaClient';
import {
  BadRequestError,
  CustomError,
  NotFoundError,
} from '../middlewares/error-handler';
import { tourInclude } from '../utils/mappers/tour.mapper';
import { type AppDeps, defaultDeps } from './deps';

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

/** Who performed a mutation, for the audit log line. */
export type TourActor = Pick<IUser, 'id' | 'role'>;

export interface TourInput {
  description?: string;
  destinationId: number;
  endDate: Date;
  maxGuests: number;
  name: string;
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
  d: Pick<AppDeps, 'clock' | 'logger' | 'prisma'>,
) => {
  const { clock, logger, prisma } = d;

  const requireDestination = async (id: number): Promise<void> => {
    const destination = await prisma.destination.findUnique({
      select: { id: true },
      where: { id },
    });
    if (!destination) throw new NotFoundError('Destination not found');
  };

  const getTourById = async (id: number) => {
    const tour = await prisma.tour.findUnique({
      include: tourInclude,
      where: { id },
    });
    if (!tour) throw new NotFoundError('Tour not found');
    return tour;
  };

  const createTour = async (input: TourInput) => {
    await requireDestination(input.destinationId);

    return prisma.tour.create({
      data: {
        description: input.description,
        destinationId: input.destinationId,
        duration: durationInDays(input.startDate, input.endDate),
        endDate: input.endDate,
        maxGuests: input.maxGuests,
        name: input.name,
        price: input.price,
        startDate: input.startDate,
        type: input.type,
      },
      include: tourInclude,
    });
  };

  const updateTour = async (id: number, input: Partial<TourInput>) => {
    const existing = await prisma.tour.findUnique({
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

    return prisma.tour.update({
      data: {
        description: input.description,
        destinationId: input.destinationId,
        duration,
        endDate: input.endDate,
        maxGuests: input.maxGuests,
        name: input.name,
        price: input.price,
        startDate: input.startDate,
        type: input.type,
      },
      include: tourInclude,
      where: { id },
    });
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
    const tour = await prisma.tour.findUnique({
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
    const tour = await prisma.tour.findUnique({
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

    await prisma.tour.delete({ where: { id } });
  };

  /**
   * Wipes every tour, but only when none of them is protected: confirmed
   * bookings, completed payments, ongoing or already-started tours all block
   * the wipe (reported together in one 409). Returns the deleted count.
   */
  const deleteAllTours = async (): Promise<number> => {
    const tourCount = await prisma.tour.count();
    if (tourCount === 0) throw new BadRequestError('No tours to delete');

    const tours = await prisma.tour.findMany({
      include: { bookings: { include: { payment: true } } },
    });

    const toursWithConfirmedBookings: number[] = [];
    const toursWithCompletedPayments: number[] = [];
    const ongoingTours: number[] = [];
    const toursAlreadyStarted: number[] = [];

    const now = clock.now();

    tours.forEach((tour) => {
      const hasConfirmedBookings = tour.bookings.some(
        (booking) => booking.status === BookingStatus.CONFIRMED,
      );
      if (hasConfirmedBookings) toursWithConfirmedBookings.push(tour.id);

      const hasCompletedPayments = tour.bookings.some(
        (booking) => booking.payment?.status === PaymentStatus.COMPLETED,
      );
      if (hasCompletedPayments) toursWithCompletedPayments.push(tour.id);

      if (tour.status === TourStatus.ONGOING) ongoingTours.push(tour.id);

      if (tour.startDate <= now && tour.endDate >= now) {
        ongoingTours.push(tour.id);
      } else if (tour.startDate <= now) {
        toursAlreadyStarted.push(tour.id);
      }
    });

    const blockingIssues: string[] = [];
    if (toursWithConfirmedBookings.length > 0) {
      blockingIssues.push(
        `${toursWithConfirmedBookings.length} tour${toursWithConfirmedBookings.length > 1 ? 's' : ''} with confirmed bookings`,
      );
    }
    if (toursWithCompletedPayments.length > 0) {
      blockingIssues.push(
        `${toursWithCompletedPayments.length} tour${toursWithCompletedPayments.length > 1 ? 's' : ''} with completed payments`,
      );
    }
    if (ongoingTours.length > 0) {
      blockingIssues.push(
        `${ongoingTours.length} ongoing tour${ongoingTours.length > 1 ? 's' : ''}`,
      );
    }
    if (toursAlreadyStarted.length > 0) {
      blockingIssues.push(
        `${toursAlreadyStarted.length} tour${toursAlreadyStarted.length > 1 ? 's' : ''} already started`,
      );
    }

    if (blockingIssues.length > 0) {
      throw new CustomError(
        HTTP_STATUS_CODES.CONFLICT,
        `Cannot delete tours: ${blockingIssues.join(', ')} must be cancelled or resolved first`,
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.tour.deleteMany({});
    });

    return tours.length;
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
    deleteAllTours,
    deleteTour,
    getTourById,
    listTours,
    updateTour,
    updateTourStatus,
  };
};

export const tourService = makeTourService(defaultDeps);

export const {
  createTour,
  deleteAllTours,
  deleteTour,
  getTourById,
  listTours,
  updateTour,
  updateTourStatus,
} = tourService;
