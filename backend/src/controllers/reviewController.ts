// src/controllers/reviewController.ts
//
// Thin HTTP adapters for the review domain: each export is a RequestHandler
// bundle of [zod validation middleware, asyncHandler(handler)]. Handlers read
// the typed req.query/body/params the middleware wrote back, call the review
// service, and reply through the standard envelope helpers. Role gates live
// in routes/review.ts (authorizeRole); ownership rules that need the row live
// in services/review.service.ts, so every handler passes the actor down.
import { Request, RequestHandler, Response } from 'express';

import { HTTP_STATUS_CODES } from '#config/constants.js';
import { asyncHandler, UnauthorizedError } from '#middlewares/error-handler.js';
import zodValidation from '#middlewares/validate-request.js';
import {
  createReview as createReviewService,
  deleteReview as deleteReviewService,
  listMyReviews,
  listReviews,
  setReviewStatus as setReviewStatusService,
  updateReview as updateReviewService,
} from '#services/review.service.js';
import { sendPaginated, sendSuccess } from '#utils/http-response.js';
import { toReviewDTO } from '#utils/mappers/review.mapper.js';
import {
  intParam,
  paginationQuery,
} from '#validations/common-validation.js';
import {
  CreateReviewBody,
  createReviewSchema,
  ReviewListQuery,
  reviewListQuery,
  ReviewStatusBody,
  reviewStatusSchema,
  UpdateReviewBody,
  updateReviewSchema,
} from '#validations/review-validation.js';

/** Reads the review id that `intParam('id')` validated and coerced. */
const reviewIdParam = (req: Request): number =>
  (req.params as unknown as { id: number }).id;

const handleCreateReview = asyncHandler(
  async (req: Request, res: Response) => {
    const body = req.body as CreateReviewBody;
    const { user } = req;
    // authenticate-jwt always sets req.user before this runs; the guard only
    // narrows the optional type (and fails closed if middleware order breaks).
    if (!user) throw new UnauthorizedError('Unauthorized, no user provided');

    const review = await createReviewService(
      { id: user.id, role: user.role },
      {
        bookingId: body.bookingId,
        comment: body.comment,
        rating: body.rating,
        title: body.title,
      },
    );
    sendSuccess(res, {
      data: toReviewDTO(review),
      message: 'Review created successfully',
      status: HTTP_STATUS_CODES.CREATED,
    });
  },
);
export const createReview: RequestHandler[] = [
  ...zodValidation.body(createReviewSchema),
  handleCreateReview,
];

const handleUpdateReview = asyncHandler(
  async (req: Request, res: Response) => {
    const body = req.body as UpdateReviewBody;
    const { user } = req;
    if (!user) throw new UnauthorizedError('Unauthorized, no user provided');

    const review = await updateReviewService(
      { id: user.id, role: user.role },
      reviewIdParam(req),
      {
        comment: body.comment,
        rating: body.rating,
        title: body.title,
      },
    );
    sendSuccess(res, {
      data: toReviewDTO(review),
      message: 'Review updated successfully',
    });
  },
);
export const updateReview: RequestHandler[] = [
  ...zodValidation.params(intParam('id')),
  ...zodValidation.body(updateReviewSchema),
  handleUpdateReview,
];

const handleDeleteReview = asyncHandler(
  async (req: Request, res: Response) => {
    const { user } = req;
    if (!user) throw new UnauthorizedError('Unauthorized, no user provided');

    await deleteReviewService({ id: user.id, role: user.role }, reviewIdParam(req));
    sendSuccess(res, { message: 'Review deleted successfully' });
  },
);
export const deleteReview: RequestHandler[] = [
  ...zodValidation.params(intParam('id')),
  handleDeleteReview,
];

const handleGetMyReviews = asyncHandler(
  async (req: Request, res: Response) => {
    const query = req.query as unknown as { limit: number; page: number };
    const { user } = req;
    if (!user) throw new UnauthorizedError('Unauthorized, no user provided');

    const { reviews, total } = await listMyReviews(
      { id: user.id, role: user.role },
      query,
    );
    sendPaginated(res, {
      data: reviews.map(toReviewDTO),
      limit: query.limit,
      message: 'Reviews retrieved successfully',
      page: query.page,
      total,
    });
  },
);
export const getMyReviews: RequestHandler[] = [
  ...zodValidation.query(paginationQuery),
  handleGetMyReviews,
];

const handleGetAllReviews = asyncHandler(
  async (req: Request, res: Response) => {
    const query = req.query as unknown as ReviewListQuery;
    const { reviews, total } = await listReviews(query);
    sendPaginated(res, {
      data: reviews.map(toReviewDTO),
      limit: query.limit,
      message: 'Reviews retrieved successfully',
      page: query.page,
      total,
    });
  },
);
export const getAllReviews: RequestHandler[] = [
  ...zodValidation.query(reviewListQuery),
  handleGetAllReviews,
];

const handleUpdateReviewStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const { status } = req.body as ReviewStatusBody;
    const { user } = req;
    if (!user) throw new UnauthorizedError('Unauthorized, no user provided');

    const review = await setReviewStatusService(
      { id: user.id, role: user.role },
      reviewIdParam(req),
      status,
    );
    sendSuccess(res, {
      data: toReviewDTO(review),
      message: 'Review status updated successfully',
    });
  },
);
export const updateReviewStatus: RequestHandler[] = [
  ...zodValidation.params(intParam('id')),
  ...zodValidation.body(reviewStatusSchema),
  handleUpdateReviewStatus,
];
