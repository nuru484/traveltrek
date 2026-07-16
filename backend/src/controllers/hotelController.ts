// src/controllers/hotelController.ts
//
// Thin HTTP adapters for the hotel domain: each export is a RequestHandler
// bundle of [multer/photo middleware where relevant, zod validation
// middleware, asyncHandler(handler)]. Handlers read the typed
// req.query/body/params the middleware wrote back, call the hotel service,
// and reply through the standard envelope helpers. All domain logic lives in
// services/hotel.service.ts; role gates live in routes/hotel.ts
// (authorizeRole), so no handler re-checks req.user.role.
import { Request, RequestHandler, Response } from 'express';

import {
  CLOUDINARY_UPLOAD_OPTIONS,
  HTTP_STATUS_CODES,
} from '#config/constants.js';
import multerUpload from '#config/multer.js';
import conditionalCloudinaryUpload from '#middlewares/conditional-cloudinary-upload.js';
import { asyncHandler, ValidationError } from '#middlewares/error-handler.js';
import zodValidation from '#middlewares/validate-request.js';
import {
  createHotel as createHotelService,
  deleteAllHotels as deleteAllHotelsService,
  deleteHotel as deleteHotelService,
  getHotelById,
  listHotels,
  listHotelsByDestination,
  updateHotel as updateHotelService,
} from '#services/hotel.service.js';
import {
  ratingSummariesFor,
  ratingSummaryForHotel,
} from '#services/review.service.js';
import { sendPaginated, sendSuccess } from '#utils/http-response.js';
import { toHotelDTO } from '#utils/mappers/hotel.mapper.js';
import { EMPTY_RATING } from '#utils/mappers/review.mapper.js';
import { intParam, paginationQuery } from '#validations/common-validation.js';
import {
  CreateHotelBody,
  createHotelSchema,
  HotelListQuery,
  hotelListQuery,
  UpdateHotelBody,
  updateHotelSchema,
} from '#validations/hotel-validation.js';

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
 * legacy hotelPhotoValidation checks — same messages, same validation-error
 * envelope.
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
      field: 'hotelPhoto',
      message: 'Photo must be a valid image file (JPEG, PNG, or WebP)',
    });
  }
  if (file.size > MAX_PHOTO_SIZE_BYTES) {
    errors.push({
      field: 'hotelPhoto',
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

/** Reads the hotel id that `intParam('id')` validated and coerced. */
const hotelIdParam = (req: Request): number =>
  (req.params as unknown as { id: number }).id;

const handleCreateHotel = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as CreateHotelBody;
  const hotel = await createHotelService({
    address: body.address,
    amenities: body.amenities,
    description: body.description,
    destinationId: body.destinationId,
    name: body.name,
    phone: body.phone,
    photo: body.hotelPhoto,
    starRating: body.starRating,
  });
  sendSuccess(res, {
    // A brand-new hotel cannot have reviews yet — no aggregate query needed.
    data: toHotelDTO(hotel, EMPTY_RATING),
    message: 'Hotel created successfully',
    status: HTTP_STATUS_CODES.CREATED,
  });
});
export const createHotel: RequestHandler[] = [
  multerUpload.single('hotelPhoto'),
  validatePhotoFile,
  ...zodValidation.body(createHotelSchema),
  conditionalCloudinaryUpload(CLOUDINARY_UPLOAD_OPTIONS, 'hotelPhoto'),
  handleCreateHotel,
];

const handleUpdateHotel = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as UpdateHotelBody;
  const hotel = await updateHotelService(hotelIdParam(req), {
    address: body.address,
    amenities: body.amenities,
    description: body.description,
    destinationId: body.destinationId,
    name: body.name,
    phone: body.phone,
    photo: body.hotelPhoto,
    starRating: body.starRating,
  });
  const rating = await ratingSummaryForHotel(hotel.id);
  sendSuccess(res, {
    data: toHotelDTO(hotel, rating),
    message: 'Hotel updated successfully',
  });
});
export const updateHotel: RequestHandler[] = [
  multerUpload.single('hotelPhoto'),
  ...zodValidation.params(intParam('id')),
  validatePhotoFile,
  ...zodValidation.body(updateHotelSchema),
  conditionalCloudinaryUpload(CLOUDINARY_UPLOAD_OPTIONS, 'hotelPhoto'),
  handleUpdateHotel,
];

const handleGetHotel = asyncHandler(async (req: Request, res: Response) => {
  const hotel = await getHotelById(hotelIdParam(req));
  const rating = await ratingSummaryForHotel(hotel.id);
  sendSuccess(res, {
    data: toHotelDTO(hotel, rating),
    message: 'Hotel retrieved successfully',
  });
});
export const getHotel: RequestHandler[] = [
  ...zodValidation.params(intParam('id')),
  handleGetHotel,
];

const handleGetAllHotels = asyncHandler(
  async (req: Request, res: Response) => {
    const query = req.query as unknown as HotelListQuery;
    const { hotels, total } = await listHotels(query);
    // One aggregate query over the page's ids — no per-row rating lookups.
    const ratings = await ratingSummariesFor(
      'hotel',
      hotels.map((h) => h.id),
    );
    sendPaginated(res, {
      data: hotels.map((hotel) =>
        toHotelDTO(hotel, ratings.get(hotel.id) ?? EMPTY_RATING),
      ),
      limit: query.limit,
      message: 'Hotels retrieved successfully',
      page: query.page,
      total,
    });
  },
);
export const getAllHotels: RequestHandler[] = [
  ...zodValidation.query(hotelListQuery),
  handleGetAllHotels,
];

const handleGetHotelsByDestination = asyncHandler(
  async (req: Request, res: Response) => {
    const { destinationId } = req.params as unknown as {
      destinationId: number;
    };
    const query = req.query as unknown as { limit: number; page: number };
    const { hotels, total } = await listHotelsByDestination(
      destinationId,
      query,
    );
    const ratings = await ratingSummariesFor(
      'hotel',
      hotels.map((h) => h.id),
    );
    sendPaginated(res, {
      data: hotels.map((hotel) =>
        toHotelDTO(hotel, ratings.get(hotel.id) ?? EMPTY_RATING),
      ),
      limit: query.limit,
      message: 'Hotels retrieved successfully',
      page: query.page,
      total,
    });
  },
);
export const getHotelsByDestination: RequestHandler[] = [
  ...zodValidation.params(intParam('destinationId')),
  ...zodValidation.query(paginationQuery),
  handleGetHotelsByDestination,
];

const handleDeleteHotel = asyncHandler(async (req: Request, res: Response) => {
  await deleteHotelService(hotelIdParam(req));
  sendSuccess(res, { message: 'Hotel deleted successfully' });
});
export const deleteHotel: RequestHandler[] = [
  ...zodValidation.params(intParam('id')),
  handleDeleteHotel,
];

// The legacy handler re-checked req.user/role (ADMIN) inline; routes/hotel.ts
// already gates this route with authorizeRole([ADMIN]), so the duplicate
// check was dropped in the refactor.
const handleDeleteAllHotels = asyncHandler(
  async (_req: Request, res: Response) => {
    const deletedCount = await deleteAllHotelsService();
    sendSuccess(res, {
      data: { deletedCount },
      message: `Successfully deleted ${deletedCount} hotel${deletedCount > 1 ? 's' : ''}`,
    });
  },
);
export const deleteAllHotels: RequestHandler[] = [handleDeleteAllHotels];
