// src/controllers/flightController.ts
//
// Thin HTTP adapters for the flight domain: each export is a RequestHandler
// bundle of [multer/photo middleware where relevant, zod validation
// middleware, asyncHandler(handler)]. Handlers read the typed
// req.query/body/params the middleware wrote back, call the flight service,
// and reply through the standard envelope helpers. All domain logic (status
// state machine and seat accounting included) lives in
// services/flight.service.ts; role gates live in routes/flight.ts
// (authorizeRole), so the legacy in-handler role re-checks on
// status/delete were dropped as duplicates.
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
  createFlight as createFlightService,
  deleteFlight as deleteFlightService,
  getFlightById,
  getFlightStats as getFlightStatsService,
  listFlights,
  updateFlight as updateFlightService,
  updateFlightStatus as updateFlightStatusService,
} from '#services/flight.service.js';
import {
  ratingSummariesFor,
  ratingSummaryForFlight,
} from '#services/review.service.js';
import { UserRole } from '#types/user-profile.types.js';
import { buildPaginationMeta, sendSuccess } from '#utils/http-response.js';
import {
  toFlightDetailDTO,
  toFlightDTO,
  toFlightListItemDTO,
} from '#utils/mappers/flight.mapper.js';
import { EMPTY_RATING } from '#utils/mappers/review.mapper.js';
import { intParam } from '#validations/common-validation.js';
import {
  CreateFlightBody,
  createFlightSchema,
  FlightListQuery,
  flightListQuery,
  FlightStatusBody,
  flightStatusSchema,
  UpdateFlightBody,
  updateFlightSchema,
} from '#validations/flight-validation.js';

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
 * legacy flightPhotoValidation checks — same messages, same
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
      field: 'flightPhoto',
      message: 'Flight photo must be a valid image file (JPEG, PNG, or WebP)',
    });
  }
  if (file.size > MAX_PHOTO_SIZE_BYTES) {
    errors.push({
      field: 'flightPhoto',
      message: 'Flight photo size must not exceed 5MB',
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

/** Reads the flight id that `intParam('id')` validated and coerced. */
const flightIdParam = (req: Request): number =>
  (req.params as unknown as { id: number }).id;

const handleCreateFlight = asyncHandler(
  async (req: Request, res: Response) => {
    const body = req.body as CreateFlightBody;
    const flight = await createFlightService({
      airline: body.airline,
      arrival: body.arrival,
      capacity: body.capacity,
      departure: body.departure,
      destinationId: body.destinationId,
      flightClass: body.flightClass,
      flightNumber: body.flightNumber,
      originId: body.originId,
      photo: body.flightPhoto,
      price: body.price,
      stops: body.stops,
    });
    sendSuccess(res, {
      data: toFlightDTO(flight),
      message: 'Flight created successfully',
      status: HTTP_STATUS_CODES.CREATED,
    });
  },
);
export const createFlight: RequestHandler[] = [
  multerUpload.single('flightPhoto'),
  validatePhotoFile,
  ...zodValidation.body(createFlightSchema),
  conditionalCloudinaryUpload(CLOUDINARY_UPLOAD_OPTIONS, 'flightPhoto'),
  handleCreateFlight,
];

const handleGetFlight = asyncHandler(async (req: Request, res: Response) => {
  const flight = await getFlightById(flightIdParam(req));
  const rating = await ratingSummaryForFlight(flight.id);
  sendSuccess(res, {
    data: toFlightDetailDTO(flight, rating),
    message: 'Flight retrieved successfully',
  });
});
export const getFlight: RequestHandler[] = [
  ...zodValidation.params(intParam('id')),
  handleGetFlight,
];

const handleUpdateFlight = asyncHandler(
  async (req: Request, res: Response) => {
    const body = req.body as UpdateFlightBody;
    const flight = await updateFlightService(flightIdParam(req), {
      airline: body.airline,
      arrival: body.arrival,
      capacity: body.capacity,
      departure: body.departure,
      destinationId: body.destinationId,
      flightClass: body.flightClass,
      flightNumber: body.flightNumber,
      originId: body.originId,
      photo: body.flightPhoto,
      price: body.price,
      status: body.status,
      stops: body.stops,
    });
    sendSuccess(res, {
      data: toFlightDTO(flight),
      message: 'Flight updated successfully',
    });
  },
);
export const updateFlight: RequestHandler[] = [
  multerUpload.single('flightPhoto'),
  ...zodValidation.params(intParam('id')),
  validatePhotoFile,
  ...zodValidation.body(updateFlightSchema),
  conditionalCloudinaryUpload(CLOUDINARY_UPLOAD_OPTIONS, 'flightPhoto'),
  handleUpdateFlight,
];

const handleGetAllFlights = asyncHandler(
  async (req: Request, res: Response) => {
    const query = req.query as unknown as FlightListQuery;
    const { flights, total } = await listFlights(query);
    // One aggregate query over the page's ids — no per-row rating lookups.
    const ratings = await ratingSummariesFor(
      'flight',
      flights.map((f) => f.id),
    );
    // The legacy list meta also echoed the applied filters; keep that shape.
    const meta = {
      ...buildPaginationMeta(total, query.page, query.limit),
      filters: {
        airline: query.airline,
        departureFrom: query.departureFrom,
        departureTo: query.departureTo,
        destinationId: query.destinationId,
        flightClass: query.flightClass,
        maxDuration: query.maxDuration,
        maxPrice: query.maxPrice,
        maxStops: query.maxStops,
        minPrice: query.minPrice,
        minSeats: query.minSeats,
        originId: query.originId,
        search: query.search,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
      },
    };
    sendSuccess(res, {
      data: flights.map((flight) =>
        toFlightListItemDTO(flight, ratings.get(flight.id) ?? EMPTY_RATING),
      ),
      message: 'Flights retrieved successfully',
      meta,
    });
  },
);
export const getAllFlights: RequestHandler[] = [
  ...zodValidation.query(flightListQuery),
  handleGetAllFlights,
];

const handleUpdateFlightStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const body = req.body as FlightStatusBody;
    const { user } = req;
    // authenticate-jwt always sets req.user before this runs; the guard only
    // narrows the optional type (and fails closed if middleware order breaks).
    if (!user) throw new UnauthorizedError('Unauthorized, no user provided');
    const flight = await updateFlightStatusService(
      { id: user.id, role: user.role },
      flightIdParam(req),
      body,
    );
    sendSuccess(res, {
      data: toFlightDTO(flight),
      message: 'Flight status updated successfully',
    });
  },
);
export const updateFlightStatus: RequestHandler[] = [
  ...zodValidation.params(intParam('id')),
  ...zodValidation.body(flightStatusSchema),
  handleUpdateFlightStatus,
];

const handleDeleteFlight = asyncHandler(
  async (req: Request, res: Response) => {
    const summary = await deleteFlightService(flightIdParam(req));
    sendSuccess(res, {
      data: summary,
      message: 'Flight deleted successfully',
    });
  },
);
export const deleteFlight: RequestHandler[] = [
  ...zodValidation.params(intParam('id')),
  handleDeleteFlight,
];

// No route mounts this handler today, so there is no authorizeRole gate to
// lean on — the legacy in-handler user/role guard is kept (the one deliberate
// exception to the "roles live in routes" rule above).
const handleGetFlightStats = asyncHandler(
  async (req: Request, res: Response) => {
    const { user } = req;
    if (!user) {
      throw new UnauthorizedError('Unauthorized, no user provided');
    }
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.AGENT) {
      throw new UnauthorizedError(
        'Only admins and agents can view flight statistics',
      );
    }
    const stats = await getFlightStatsService();
    sendSuccess(res, {
      data: stats,
      message: 'Flight statistics retrieved successfully',
    });
  },
);
export const getFlightStats: RequestHandler[] = [handleGetFlightStats];
