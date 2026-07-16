// src/controllers/tourController.ts
//
// Thin HTTP adapters for the tour domain: each export is a RequestHandler
// bundle of [multer/photo middleware where relevant, zod validation
// middleware, asyncHandler(handler)]. Handlers read the typed
// req.query/body/params the middleware wrote back, call the tour service, and
// reply through the standard envelope helpers. All domain logic lives in
// services/tour.service.ts; role gates live in routes/tour.ts
// (authorizeRole), so no handler re-checks req.user.role.
import { Request, RequestHandler, Response } from 'express';

import {
  CLOUDINARY_UPLOAD_OPTIONS,
  HTTP_STATUS_CODES,
} from '#config/constants.js';
import multerUpload from '#config/multer.js';
import conditionalCloudinaryUpload from '#middlewares/conditional-cloudinary-upload.js';
import {
  asyncHandler,
  UnauthorizedError,
  ValidationError,
} from '#middlewares/error-handler.js';
import zodValidation from '#middlewares/validate-request.js';
import {
  ratingSummariesFor,
  ratingSummaryForTour,
} from '#services/review.service.js';
import {
  createTour as createTourService,
  deleteTour as deleteTourService,
  getTourById,
  listTours,
  updateTour as updateTourService,
  updateTourStatus as updateTourStatusService,
} from '#services/tour.service.js';
import { sendPaginated, sendSuccess } from '#utils/http-response.js';
import { EMPTY_RATING } from '#utils/mappers/review.mapper.js';
import { toTourDTO, toTourStatusDTO } from '#utils/mappers/tour.mapper.js';
import { intParam } from '#validations/common-validation.js';
import {
  CreateTourBody,
  createTourSchema,
  TourListQuery,
  tourListQuery,
  TourStatusBody,
  tourStatusSchema,
  UpdateTourBody,
  updateTourSchema,
} from '#validations/tour-validation.js';

const ALLOWED_PHOTO_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
];
const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

/**
 * Guards the multer-parsed photo file (type + size) before the Cloudinary
 * upload middleware runs. Zod validates req.body only, so the file checks
 * live here — same messages and validation-error envelope as the hotel and
 * flight photo pipelines.
 */
const validatePhotoFile: RequestHandler = (req, _res, next) => {
  const { file } = req;
  if (!file) {
    next();
    return;
  }

  const errors: { field: string; message: string }[] = [];
  if (!ALLOWED_PHOTO_MIME_TYPES.includes(file.mimetype)) {
    errors.push({
      field: 'tourPhoto',
      message: 'Tour photo must be a valid image file (JPEG, PNG, or WebP)',
    });
  }
  if (file.size > MAX_PHOTO_SIZE_BYTES) {
    errors.push({
      field: 'tourPhoto',
      message: 'Tour photo size must not exceed 5MB',
    });
  }

  if (errors.length > 0) {
    next(
      new ValidationError('Validation Error', {
        code: 'VALIDATION_ERROR',
        context: { errors },
        layer: 'Request Validation',
      }),
    );
    return;
  }
  next();
};

/** Reads the tour id that `intParam('id')` validated and coerced to a number. */
const tourIdParam = (req: Request): number =>
  (req.params as unknown as { id: number }).id;

const handleCreateTour = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as CreateTourBody;
  const tour = await createTourService({
    description: body.description,
    destinationId: body.destinationId,
    endDate: body.endDate,
    maxGuests: body.maxGuests,
    name: body.name,
    photo: body.tourPhoto,
    price: body.price,
    startDate: body.startDate,
    type: body.type,
  });
  sendSuccess(res, {
    // A brand-new tour cannot have reviews yet — no aggregate query needed.
    data: toTourDTO(tour, EMPTY_RATING),
    message: 'Tour created successfully',
    status: HTTP_STATUS_CODES.CREATED,
  });
});
export const createTour: RequestHandler[] = [
  multerUpload.single('tourPhoto'),
  validatePhotoFile,
  ...zodValidation.body(createTourSchema),
  conditionalCloudinaryUpload(CLOUDINARY_UPLOAD_OPTIONS, 'tourPhoto'),
  handleCreateTour,
];

const handleGetTour = asyncHandler(async (req: Request, res: Response) => {
  const tour = await getTourById(tourIdParam(req));
  const rating = await ratingSummaryForTour(tour.id);
  sendSuccess(res, {
    data: toTourDTO(tour, rating),
    message: 'Tour retrieved successfully',
  });
});
export const getTour: RequestHandler[] = [
  ...zodValidation.params(intParam('id')),
  handleGetTour,
];

const handleUpdateTour = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as UpdateTourBody;
  const tour = await updateTourService(tourIdParam(req), {
    description: body.description,
    destinationId: body.destinationId,
    endDate: body.endDate,
    maxGuests: body.maxGuests,
    name: body.name,
    photo: body.tourPhoto,
    price: body.price,
    startDate: body.startDate,
    type: body.type,
  });
  const rating = await ratingSummaryForTour(tour.id);
  sendSuccess(res, {
    data: toTourDTO(tour, rating),
    message: 'Tour updated successfully',
  });
});
export const updateTour: RequestHandler[] = [
  multerUpload.single('tourPhoto'),
  ...zodValidation.params(intParam('id')),
  validatePhotoFile,
  ...zodValidation.body(updateTourSchema),
  conditionalCloudinaryUpload(CLOUDINARY_UPLOAD_OPTIONS, 'tourPhoto'),
  handleUpdateTour,
];

const handleUpdateTourStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const { status } = req.body as TourStatusBody;
    const { user } = req;
    // authenticate-jwt always sets req.user before this runs; the guard only
    // narrows the optional type (and fails closed if middleware order breaks).
    if (!user) throw new UnauthorizedError();
    const tour = await updateTourStatusService(
      { id: user.id, role: user.role },
      tourIdParam(req),
      status,
    );
    sendSuccess(res, {
      data: toTourStatusDTO(tour),
      message: 'Tour status updated successfully',
    });
  },
);
export const updateTourStatus: RequestHandler[] = [
  ...zodValidation.params(intParam('id')),
  ...zodValidation.body(tourStatusSchema),
  handleUpdateTourStatus,
];

const handleDeleteTour = asyncHandler(async (req: Request, res: Response) => {
  await deleteTourService(tourIdParam(req));
  sendSuccess(res, { message: 'Tour deleted successfully' });
});
export const deleteTour: RequestHandler[] = [
  ...zodValidation.params(intParam('id')),
  handleDeleteTour,
];

const handleGetAllTours = asyncHandler(
  async (req: Request, res: Response) => {
    const query = req.query as unknown as TourListQuery;
    const { total, tours } = await listTours(query);
    // One aggregate query over the page's ids — no per-row rating lookups.
    const ratings = await ratingSummariesFor(
      'tour',
      tours.map((t) => t.id),
    );
    sendPaginated(res, {
      data: tours.map((tour) =>
        toTourDTO(tour, ratings.get(tour.id) ?? EMPTY_RATING),
      ),
      limit: query.limit,
      message: 'Tours retrieved successfully',
      page: query.page,
      total,
    });
  },
);
export const getAllTours: RequestHandler[] = [
  ...zodValidation.query(tourListQuery),
  handleGetAllTours,
];
