import { defaultDeps } from '#services/deps.js';
// src/services/flight.service.ts
//
// Thin composer for the flights domain. The implementation is split into
// modules under ./flight: shared.ts (types, the sort-field whitelist, the
// non-deletable status set), core.ts (Cloudinary cleanup + duration
// derivation), and one module per surface (create, update, status/delete,
// query/stats). makeFlightService builds the core once and spreads each
// feature factory into one object, preserving the public surface
// controllers/workers/validation/tests import from this path.
//
// Role enforcement note: routes/flight.ts is the single authorization
// boundary (authorizeRole); the service modules carry no duplicate role
// checks, as before.
import { makeFlightCore } from '#services/flight/core.js';
import { makeFlightCreateService } from '#services/flight/create.service.js';
import { makeFlightQueryService } from '#services/flight/query.service.js';
import {
  FLIGHT_SORT_FIELDS,
  type FlightActor,
  type FlightDeleteSummary,
  type FlightDeps,
  type FlightInput,
  type FlightListParams,
  type FlightSortField,
  type FlightStatusChangeInput,
  type FlightUpdateInput,
  type PublicFlightListParams,
} from '#services/flight/shared.js';
import { makeFlightStatusService } from '#services/flight/status.service.js';
import { makeFlightUpdateService } from '#services/flight/update.service.js';

// Re-export the public types/consts controllers/validation/tests import from
// this module path (unchanged from the pre-split surface).
export {
  FLIGHT_SORT_FIELDS,
  type FlightActor,
  type FlightDeleteSummary,
  type FlightInput,
  type FlightListParams,
  type FlightSortField,
  type FlightStatusChangeInput,
  type FlightUpdateInput,
  type PublicFlightListParams,
};

export const makeFlightService = (d: FlightDeps) => {
  const core = makeFlightCore(d);
  return {
    ...makeFlightCreateService(d, core),
    ...makeFlightUpdateService(d, core),
    ...makeFlightStatusService(d, core),
    ...makeFlightQueryService(d),
  };
};

export const flightService = makeFlightService(defaultDeps);

export const {
  createFlight,
  deleteFlight,
  getFlightById,
  getFlightStats,
  listFlights,
  listPublicFlights,
  updateFlight,
  updateFlightStatus,
} = flightService;
