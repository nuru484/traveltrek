// src/controllers/destinationController.ts
//
// Thin HTTP adapters for the destination domain: each export is a
// RequestHandler bundle of [multer/photo middleware where relevant, zod
// validation middleware, asyncHandler(handler)]. Handlers read the typed
// req.query/body/params the middleware wrote back, call the destination
// service, and reply through the standard envelope helpers. All domain logic
// lives in services/destination.service.ts; role gates live in
// routes/destination.ts (authorizeRole), so no handler re-checks
// req.user.role.
import { Request, RequestHandler, Response } from 'express';

import { CLOUDINARY_UPLOAD_OPTIONS, HTTP_STATUS_CODES } from '../config/constants';
import multerUpload from '../config/multer';
import conditionalCloudinaryUpload from '../middlewares/conditional-cloudinary-upload';
import { asyncHandler, ValidationError } from '../middlewares/error-handler';
import zodValidation from '../middlewares/validate-request';
import {
  createDestination as createDestinationService,
  deleteAllDestinations as deleteAllDestinationsService,
  deleteDestination as deleteDestinationService,
  getDestinationById,
  listDestinations,
  updateDestination as updateDestinationService,
} from '../services/destination.service';
import { buildPaginationMeta, sendSuccess } from '../utils/http-response';
import { toDestinationDTO } from '../utils/mappers/destination.mapper';
import { intParam } from '../validations/common-validation';
import {
  CreateDestinationBody,
  createDestinationSchema,
  DestinationListQuery,
  destinationListQuery,
  UpdateDestinationBody,
  updateDestinationSchema,
} from '../validations/destination-validation';

const ALLOWED_PHOTO_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
];
const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

/**
 * Guards the multer-parsed photo file (type + size) before the Cloudinary
 * upload middleware runs. Zod validates req.body only, so this keeps the
 * legacy destinationPhotoValidation checks — same messages, same
 * validation-error envelope.
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
      field: 'destinationPhoto',
      message: 'Photo must be a valid image file (JPEG, PNG, or WebP)',
    });
  }
  if (file.size > MAX_PHOTO_SIZE_BYTES) {
    errors.push({
      field: 'destinationPhoto',
      message: 'Photo size must not exceed 5MB',
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

/** Reads the destination id that `intParam('id')` validated and coerced. */
const destinationIdParam = (req: Request): number =>
  (req.params as unknown as { id: number }).id;

const handleCreateDestination = asyncHandler(
  async (req: Request, res: Response) => {
    const body = req.body as CreateDestinationBody;
    const destination = await createDestinationService({
      city: body.city,
      country: body.country,
      description: body.description,
      name: body.name,
      photo: body.destinationPhoto,
    });
    sendSuccess(res, {
      data: toDestinationDTO(destination),
      message: 'Destination created successfully',
      status: HTTP_STATUS_CODES.CREATED,
    });
  },
);
export const createDestination: RequestHandler[] = [
  multerUpload.single('destinationPhoto'),
  validatePhotoFile,
  ...zodValidation.body(createDestinationSchema),
  conditionalCloudinaryUpload(CLOUDINARY_UPLOAD_OPTIONS, 'destinationPhoto'),
  handleCreateDestination,
];

const handleGetDestination = asyncHandler(
  async (req: Request, res: Response) => {
    const destination = await getDestinationById(destinationIdParam(req));
    sendSuccess(res, {
      data: toDestinationDTO(destination),
      message: 'Destination retrieved successfully',
    });
  },
);
export const getDestination: RequestHandler[] = [
  ...zodValidation.params(intParam('id')),
  handleGetDestination,
];

const handleUpdateDestination = asyncHandler(
  async (req: Request, res: Response) => {
    const body = req.body as UpdateDestinationBody;
    const destination = await updateDestinationService(
      destinationIdParam(req),
      {
        city: body.city,
        country: body.country,
        description: body.description,
        name: body.name,
        photo: body.destinationPhoto,
      },
    );
    sendSuccess(res, {
      data: toDestinationDTO(destination),
      message: 'Destination updated successfully',
    });
  },
);
export const updateDestination: RequestHandler[] = [
  multerUpload.single('destinationPhoto'),
  ...zodValidation.params(intParam('id')),
  validatePhotoFile,
  ...zodValidation.body(updateDestinationSchema),
  conditionalCloudinaryUpload(CLOUDINARY_UPLOAD_OPTIONS, 'destinationPhoto'),
  handleUpdateDestination,
];

const handleDeleteDestination = asyncHandler(
  async (req: Request, res: Response) => {
    await deleteDestinationService(destinationIdParam(req));
    sendSuccess(res, { message: 'Destination deleted successfully' });
  },
);
export const deleteDestination: RequestHandler[] = [
  ...zodValidation.params(intParam('id')),
  handleDeleteDestination,
];

const handleGetAllDestinations = asyncHandler(
  async (req: Request, res: Response) => {
    const query = req.query as unknown as DestinationListQuery;
    const { destinations, total } = await listDestinations(query);
    // The legacy list meta also echoed the applied filters; keep that shape.
    const meta = {
      ...buildPaginationMeta(total, query.page, query.limit),
      filters: {
        city: query.city,
        country: query.country,
        search: query.search,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
      },
    };
    sendSuccess(res, {
      data: destinations.map(toDestinationDTO),
      message: 'Destinations retrieved successfully',
      meta,
    });
  },
);
export const getAllDestinations: RequestHandler[] = [
  ...zodValidation.query(destinationListQuery),
  handleGetAllDestinations,
];

const handleDeleteAllDestinations = asyncHandler(
  async (_req: Request, res: Response) => {
    const deletedCount = await deleteAllDestinationsService();
    sendSuccess(res, {
      message:
        deletedCount === 0
          ? 'No destinations found to delete'
          : 'All destinations deleted successfully',
    });
  },
);
export const deleteAllDestinations: RequestHandler[] = [
  handleDeleteAllDestinations,
];
