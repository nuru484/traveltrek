// src/controllers/tourController.ts
//
// Thin HTTP adapters for the tour domain: each export is a RequestHandler
// bundle of [zod validation middleware, asyncHandler(handler)]. Handlers read
// the typed req.query/body/params the middleware wrote back, call the tour
// service, and reply through the standard envelope helpers. All domain logic
// lives in services/tour.service.ts; role gates live in routes/tour.ts
// (authorizeRole), so no handler re-checks req.user.role.
import { Request, RequestHandler, Response } from 'express';

import { HTTP_STATUS_CODES } from '../config/constants';
import { asyncHandler, UnauthorizedError } from '../middlewares/error-handler';
import zodValidation from '../middlewares/validate-request';
import {
  createTour as createTourService,
  deleteAllTours as deleteAllToursService,
  deleteTour as deleteTourService,
  getTourById,
  listTours,
  updateTour as updateTourService,
  updateTourStatus as updateTourStatusService,
} from '../services/tour.service';
import { sendPaginated, sendSuccess } from '../utils/http-response';
import { toTourDTO, toTourStatusDTO } from '../utils/mappers/tour.mapper';
import { intParam } from '../validations/common-validation';
import {
  CreateTourBody,
  createTourSchema,
  TourListQuery,
  tourListQuery,
  TourStatusBody,
  tourStatusSchema,
  UpdateTourBody,
  updateTourSchema,
} from '../validations/tour-validation';

/** Reads the tour id that `intParam('id')` validated and coerced to a number. */
const tourIdParam = (req: Request): number =>
  (req.params as unknown as { id: number }).id;

const handleCreateTour = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as CreateTourBody;
  const tour = await createTourService(body);
  sendSuccess(res, {
    data: toTourDTO(tour),
    message: 'Tour created successfully',
    status: HTTP_STATUS_CODES.CREATED,
  });
});
export const createTour: RequestHandler[] = [
  ...zodValidation.body(createTourSchema),
  handleCreateTour,
];

const handleGetTour = asyncHandler(async (req: Request, res: Response) => {
  const tour = await getTourById(tourIdParam(req));
  sendSuccess(res, {
    data: toTourDTO(tour),
    message: 'Tour retrieved successfully',
  });
});
export const getTour: RequestHandler[] = [
  ...zodValidation.params(intParam('id')),
  handleGetTour,
];

const handleUpdateTour = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as UpdateTourBody;
  const tour = await updateTourService(tourIdParam(req), body);
  sendSuccess(res, {
    data: toTourDTO(tour),
    message: 'Tour updated successfully',
  });
});
export const updateTour: RequestHandler[] = [
  ...zodValidation.params(intParam('id')),
  ...zodValidation.body(updateTourSchema),
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
    sendPaginated(res, {
      data: tours.map(toTourDTO),
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

const handleDeleteAllTours = asyncHandler(
  async (_req: Request, res: Response) => {
    const deletedCount = await deleteAllToursService();
    sendSuccess(res, {
      data: { deletedCount },
      message: `Successfully deleted ${deletedCount} tour${deletedCount > 1 ? 's' : ''}`,
    });
  },
);
export const deleteAllTours: RequestHandler[] = [handleDeleteAllTours];
