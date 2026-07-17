import { defaultDeps } from '#services/deps.js';
// src/services/tour.service.ts
//
// Thin composer for the tours domain. The implementation is split into modules
// under ./tour: shared.ts (sort-field whitelist, request types, the pure
// duration helper), core.ts (photo cleanup, destination guard, the list
// where-clause), and one module per surface (create, update, status/delete,
// query). makeTourService builds the core once and spreads each feature
// factory into one object, preserving the public surface.
//
// Role enforcement note: routes/tour.ts is the single authorization boundary
// (authorizeRole); the service modules carry no duplicate role checks.
import { makeTourCore } from '#services/tour/core.js';
import { makeTourCreateService } from '#services/tour/create.service.js';
import { makeTourQueryService } from '#services/tour/query.service.js';
import {
  type PublicTourListParams,
  TOUR_SORT_FIELDS,
  type TourActor,
  type TourDeps,
  type TourInput,
  type TourListParams,
  type TourSortField,
} from '#services/tour/shared.js';
import { makeTourStatusService } from '#services/tour/status.service.js';
import { makeTourUpdateService } from '#services/tour/update.service.js';

// Re-export the public types/consts controllers/validation/tests import from
// this module path (unchanged from the pre-split surface).
export {
  type PublicTourListParams,
  TOUR_SORT_FIELDS,
  type TourActor,
  type TourInput,
  type TourListParams,
  type TourSortField,
};

export const makeTourService = (d: TourDeps) => {
  const core = makeTourCore(d);
  return {
    ...makeTourCreateService(d, core),
    ...makeTourUpdateService(d, core),
    ...makeTourStatusService(d, core),
    ...makeTourQueryService(d, core),
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
