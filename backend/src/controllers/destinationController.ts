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

import { CLOUDINARY_UPLOAD_OPTIONS, HTTP_STATUS_CODES } from '#config/constants.js';
import multerUpload from '#config/multer.js';
import conditionalCloudinaryUpload from '#middlewares/conditional-cloudinary-upload.js';
import { asyncHandler, ValidationError } from '#middlewares/error-handler.js';
import zodValidation from '#middlewares/validate-request.js';
import {
  createDestination as createDestinationService,
  deleteDestination as deleteDestinationService,
  getDestinationById,
  listDestinations,
  updateDestination as updateDestinationService,
} from '#services/destination.service.js';
import { buildPaginationMeta, sendSuccess } from '#utils/http-response.js';
import { toDestinationDTO } from '#utils/mappers/destination.mapper.js';
import { intParam } from '#validations/common-validation.js';
import {
  CreateDestinationBody,
  createDestinationSchema,
  DestinationListQuery,
  destinationListQuery,
  UpdateDestinationBody,
  updateDestinationSchema,
} from '#validations/destination-validation.js';

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
 * live here and answer in the same validation-error envelope.
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
    // The list meta echoes the applied filters alongside the page numbers.
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
