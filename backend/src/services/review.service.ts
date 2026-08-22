// src/services/review.service.ts
//
// Reviews domain logic. Pure, DI'd functions: they take typed inputs, own
// every Prisma access and domain invariant (own-completed-booking rule, the
// one-review-per-booking constraint, the 30-day edit window, moderation), and
// throw the typed CustomError subclasses. Reviews have no target columns —
// the target (tour / room / flight) is derived from the reviewed booking, so
// the rating aggregates here filter through the booking relation.
//
// Authorization note: routes/review.ts gates each route by role (customers
// create/update/list-own, staff list/moderate, delete admits ADMIN and
// CUSTOMER). Ownership rules that need the row (own booking, own review) live
// here as explicit actor-based checks.
import { HTTP_STATUS_CODES } from '#config/constants.js';
import {
  BookingStatus,
  type Prisma,
  ReviewStatus,
} from '#config/prismaClient.js';
import {
  BadRequestError,
  CustomError,
  NotFoundError,
  UnauthorizedError,
} from '#middlewares/error-handler.js';
import { type AppDeps, defaultDeps } from '#services/deps.js';
import { type IUser, UserRole } from '#types/user-profile.types.js';
import {
  EMPTY_RATING,
  type RatingSummary,
  reviewInclude,
  type ReviewWithRelations,
} from '#utils/mappers/review.mapper.js';

/** Who performed a review action; role CUSTOMER means a Customer principal. */
export type ReviewActor = Pick<IUser, 'id' | 'role'>;

export interface ReviewCreateInput {
  bookingId: number;
  comment?: string;
  rating: number;
  title?: string;
}

export interface ReviewListParams {
  limit: number;
  page: number;
  rating?: number;
  search?: string;
  status?: ReviewStatus;
}

/** What a published review may target; ids resolve via the booking relation. */
export type ReviewTargetType = 'flight' | 'hotel' | 'tour';

export interface ReviewUpdateInput {
  comment?: string;
  rating?: number;
  title?: string;
}

const DAY_MS = 1000 * 60 * 60 * 24;

/** How long (from creation) a customer may still edit their review. */
const EDIT_WINDOW_DAYS = 30;

/** Rounds a rating mean to 1 decimal for the wire. */
const round1 = (value: number): number => Math.round(value * 10) / 10;

export const makeReviewService = (
  d: Pick<AppDeps, 'clock' | 'logger' | 'prisma'>,
) => {
  const { clock, logger, prisma } = d;

  /** Booking-relation filter matching PUBLISHED reviews of the given targets. */
  const publishedTargetWhere = (
    target: ReviewTargetType,
    ids: number[],
  ): Prisma.ReviewWhereInput => ({
    booking:
      target === 'tour'
        ? { tourId: { in: ids } }
        : target === 'hotel'
          ? { room: { hotelId: { in: ids } } }
          : { flightId: { in: ids } },
    status: ReviewStatus.PUBLISHED,
  });

  // findFirst so soft-deleted reviews 404 like hard-deleted ones would.
  const requireReview = async (id: number): Promise<ReviewWithRelations> => {
    const review = await prisma.review.findFirst({
      include: reviewInclude,
      where: { id },
    });
    if (!review) throw new NotFoundError('Review not found');
    return review;
  };

  /**
   * Customer-only (route-gated): reviews the actor's OWN booking, which must
   * be COMPLETED. One review per booking — a duplicate (even a soft-deleted
   * one, which keeps holding its unique slot) is refused with a 409.
   */
  const createReview = async (actor: ReviewActor, input: ReviewCreateInput) => {
    // findFirst so a soft-deleted booking reads as not reviewable.
    const booking = await prisma.booking.findFirst({
      select: { customerId: true, id: true, status: true },
      where: { id: input.bookingId },
    });
    if (!booking) throw new NotFoundError('Booking not found');

    if (booking.customerId !== actor.id) {
      throw new UnauthorizedError('You can only review your own bookings');
    }
    if (booking.status !== BookingStatus.COMPLETED) {
      throw new BadRequestError('Only completed bookings can be reviewed');
    }

    // findUnique on purpose (unscoped): a soft-deleted review still holds the
    // booking's unique slot, so it blocks a re-review too.
    const existing = await prisma.review.findUnique({
      select: { id: true },
      where: { bookingId: input.bookingId },
    });
    if (existing) {
      throw new CustomError(
        HTTP_STATUS_CODES.CONFLICT,
        'This booking has already been reviewed',
      );
    }

    return prisma.review.create({
      data: {
        bookingId: input.bookingId,
        comment: input.comment,
        customerId: actor.id,
        rating: input.rating,
        title: input.title,
      },
      include: reviewInclude,
    });
  };

  /** Customer-only: edits the actor's own review within 30 days of posting. */
  const updateReview = async (
    actor: ReviewActor,
    id: number,
    input: ReviewUpdateInput,
  ) => {
    const review = await requireReview(id);

    if (review.customerId !== actor.id) {
      throw new UnauthorizedError('You can only update your own reviews');
    }

    const ageMs = clock.now().getTime() - review.createdAt.getTime();
    if (ageMs > EDIT_WINDOW_DAYS * DAY_MS) {
      throw new BadRequestError(
        `Reviews can only be edited within ${EDIT_WINDOW_DAYS} days of posting`,
      );
    }

    // Prisma ignores undefined keys, so omitted fields stay untouched.
    return prisma.review.update({
      data: {
        comment: input.comment,
        rating: input.rating,
        title: input.title,
      },
      include: reviewInclude,
      where: { id },
    });
  };

  /** Soft-deletes the actor's own review; an ADMIN may delete any review. */
  const deleteReview = async (actor: ReviewActor, id: number): Promise<void> => {
    const review = await requireReview(id);

    if (actor.role !== UserRole.ADMIN && review.customerId !== actor.id) {
      throw new UnauthorizedError('You can only delete your own reviews');
    }

    await prisma.review.update({
      data: { deletedAt: clock.now() },
      where: { id },
    });
  };

  /** ADMIN moderation (route-gated): hide or re-publish a review. */
  const setReviewStatus = async (
    actor: ReviewActor,
    id: number,
    status: ReviewStatus,
  ) => {
    await requireReview(id);

    const updated = await prisma.review.update({
      data: { status },
      include: reviewInclude,
      where: { id },
    });

    logger.info(
      `Review ${id} status set to ${status} by ${actor.role} ${actor.id}`,
    );

    return updated;
  };

  /** The customer's own reviews (any status), newest first. */
  const listMyReviews = async (
    actor: ReviewActor,
    params: { limit: number; page: number },
  ) => {
    const where: Prisma.ReviewWhereInput = { customerId: actor.id };
    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        include: reviewInclude,
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        where,
      }),
      prisma.review.count({ where }),
    ]);
    return { reviews, total };
  };

  /** Staff listing with status / rating / text filters, newest first. */
  const listReviews = async (params: ReviewListParams) => {
    const where: Prisma.ReviewWhereInput = {};
    if (params.status) where.status = params.status;
    if (params.rating !== undefined) where.rating = params.rating;
    if (params.search) {
      where.OR = [
        { title: { contains: params.search, mode: 'insensitive' } },
        { comment: { contains: params.search, mode: 'insensitive' } },
        { customer: { name: { contains: params.search, mode: 'insensitive' } } },
      ];
    }

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        include: reviewInclude,
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        where,
      }),
      prisma.review.count({ where }),
    ]);
    return { reviews, total };
  };

  /**
   * Rating summaries (avg + count over PUBLISHED, live rows) for a page of
   * target ids in ONE query — reviews carry no target column, so the rows are
   * fetched with their booking's target id and reduced here instead of a
   * SQL-level groupBy. Missing ids simply have no entry (callers fall back to
   * EMPTY_RATING).
   */
  const ratingSummariesFor = async (
    target: ReviewTargetType,
    ids: number[],
  ): Promise<Map<number, RatingSummary>> => {
    const summaries = new Map<number, RatingSummary>();
    if (ids.length === 0) return summaries;

    const rows = await prisma.review.findMany({
      select: {
        booking: {
          select: {
            flightId: true,
            room: { select: { hotelId: true } },
            tourId: true,
          },
        },
        rating: true,
      },
      where: publishedTargetWhere(target, ids),
    });

    const sums = new Map<number, { count: number; sum: number }>();
    for (const row of rows) {
      const targetId =
        target === 'tour'
          ? row.booking.tourId
          : target === 'hotel'
            ? row.booking.room?.hotelId
            : row.booking.flightId;
      if (targetId == null) continue;
      const entry = sums.get(targetId) ?? { count: 0, sum: 0 };
      entry.count += 1;
      entry.sum += row.rating;
      sums.set(targetId, entry);
    }

    for (const [targetId, { count, sum }] of sums) {
      summaries.set(targetId, { average: round1(sum / count), count });
    }
    return summaries;
  };

  const ratingSummaryForFlight = async (id: number): Promise<RatingSummary> =>
    (await ratingSummariesFor('flight', [id])).get(id) ?? EMPTY_RATING;

  const ratingSummaryForHotel = async (id: number): Promise<RatingSummary> =>
    (await ratingSummariesFor('hotel', [id])).get(id) ?? EMPTY_RATING;

  const ratingSummaryForTour = async (id: number): Promise<RatingSummary> =>
    (await ratingSummariesFor('tour', [id])).get(id) ?? EMPTY_RATING;

  /** Published reviews of one target, newest first (public surface). */
  const listPublishedForTarget = async (
    target: ReviewTargetType,
    id: number,
    params: { limit: number; page: number },
  ) => {
    const where = publishedTargetWhere(target, [id]);
    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        include: reviewInclude,
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        where,
      }),
      prisma.review.count({ where }),
    ]);
    return { reviews, total };
  };

  /** The latest N published reviews across every target (testimonial strip). */
  const listRecentPublished = async (limit: number) =>
    prisma.review.findMany({
      include: reviewInclude,
      orderBy: { createdAt: 'desc' },
      take: limit,
      where: { status: ReviewStatus.PUBLISHED },
    });

  return {
    createReview,
    deleteReview,
    listMyReviews,
    listPublishedForTarget,
    listRecentPublished,
    listReviews,
    ratingSummariesFor,
    ratingSummaryForFlight,
    ratingSummaryForHotel,
    ratingSummaryForTour,
    setReviewStatus,
    updateReview,
  };
};

export const reviewService = makeReviewService(defaultDeps);

export const {
  createReview,
  deleteReview,
  listMyReviews,
  listPublishedForTarget,
  listRecentPublished,
  listReviews,
  ratingSummariesFor,
  ratingSummaryForFlight,
  ratingSummaryForHotel,
  ratingSummaryForTour,
  setReviewStatus,
  updateReview,
} = reviewService;
