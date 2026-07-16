// src/controllers/publicController.ts
//
// Thin HTTP adapters for the UNAUTHENTICATED /public browse surface (the
// portfolio landing page): read-only destination/tour/hotel/flight browsing
// plus published reviews. Mounted BEFORE authenticateJWT (routes/index.ts)
// behind its own rate limiter.
//
// Privacy boundary: nothing here may leak principal data — no bookings, no
// customer ids/emails. Reviews go out through toPublicReviewDTO (reviewer
// display name only); the tour/hotel/flight DTOs carry no customer data by
// construction. Inventory is public-scoped where it differs from the admin
// listings: tours are UPCOMING/ONGOING only, flights SCHEDULED-and-future
// only (see the listPublic* service functions).
import { Request, RequestHandler, Response } from 'express';

import { asyncHandler } from '#middlewares/error-handler.js';
import zodValidation from '#middlewares/validate-request.js';
import { listDestinations } from '#services/destination.service.js';
import {
  getFlightById,
  listPublicFlights,
} from '#services/flight.service.js';
import { getHotelById, listHotels } from '#services/hotel.service.js';
import {
  listPublishedForTarget,
  listRecentPublished,
  ratingSummariesFor,
  ratingSummaryForFlight,
  ratingSummaryForHotel,
  ratingSummaryForTour,
} from '#services/review.service.js';
import { getTourById, listPublicTours } from '#services/tour.service.js';
import { sendPaginated, sendSuccess } from '#utils/http-response.js';
import { toPublicDestinationDTO } from '#utils/mappers/destination.mapper.js';
import { toFlightDetailDTO, toFlightListItemDTO } from '#utils/mappers/flight.mapper.js';
import { toHotelDTO } from '#utils/mappers/hotel.mapper.js';
import {
  EMPTY_RATING,
  toPublicReviewDTO,
} from '#utils/mappers/review.mapper.js';
import { toTourDTO } from '#utils/mappers/tour.mapper.js';
import { intParam } from '#validations/common-validation.js';
import {
  PublicFlightListQuery,
  publicFlightListQuery,
  PublicHotelListQuery,
  publicHotelListQuery,
  PublicListQuery,
  publicListQuery,
  PublicTourListQuery,
  publicTourListQuery,
  RecentReviewsQuery,
  recentReviewsQuery,
} from '#validations/public-validation.js';

/** How many published reviews a public detail page embeds (first page). */
const DETAIL_REVIEWS_LIMIT = 5;

/** Reads the id that `intParam('id')` validated and coerced. */
const idParam = (req: Request): number =>
  (req.params as unknown as { id: number }).id;

const handleGetPublicDestinations = asyncHandler(
  async (req: Request, res: Response) => {
    const query = req.query as unknown as PublicListQuery;
    const { destinations, total } = await listDestinations({
      limit: query.limit,
      page: query.page,
      sortBy: 'name',
      sortOrder: 'asc',
    });
    sendPaginated(res, {
      data: destinations.map(toPublicDestinationDTO),
      limit: query.limit,
      message: 'Destinations retrieved successfully',
      page: query.page,
      total,
    });
  },
);
export const getPublicDestinations: RequestHandler[] = [
  ...zodValidation.query(publicListQuery),
  handleGetPublicDestinations,
];

const handleGetPublicTours = asyncHandler(
  async (req: Request, res: Response) => {
    const query = req.query as unknown as PublicTourListQuery;
    const { total, tours } = await listPublicTours(query);
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
export const getPublicTours: RequestHandler[] = [
  ...zodValidation.query(publicTourListQuery),
  handleGetPublicTours,
];

const handleGetPublicTour = asyncHandler(
  async (req: Request, res: Response) => {
    const tour = await getTourById(idParam(req));
    const [rating, { reviews, total }] = await Promise.all([
      ratingSummaryForTour(tour.id),
      listPublishedForTarget('tour', tour.id, {
        limit: DETAIL_REVIEWS_LIMIT,
        page: 1,
      }),
    ]);
    sendSuccess(res, {
      data: {
        ...toTourDTO(tour, rating),
        reviews: reviews.map(toPublicReviewDTO),
        reviewsTotal: total,
      },
      message: 'Tour retrieved successfully',
    });
  },
);
export const getPublicTour: RequestHandler[] = [
  ...zodValidation.params(intParam('id')),
  handleGetPublicTour,
];

const handleGetPublicHotels = asyncHandler(
  async (req: Request, res: Response) => {
    const query = req.query as unknown as PublicHotelListQuery;
    const { hotels, total } = await listHotels({
      destinationId: query.destinationId,
      limit: query.limit,
      page: query.page,
      search: query.search,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
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
export const getPublicHotels: RequestHandler[] = [
  ...zodValidation.query(publicHotelListQuery),
  handleGetPublicHotels,
];

const handleGetPublicHotel = asyncHandler(
  async (req: Request, res: Response) => {
    const hotel = await getHotelById(idParam(req));
    const [rating, { reviews, total }] = await Promise.all([
      ratingSummaryForHotel(hotel.id),
      listPublishedForTarget('hotel', hotel.id, {
        limit: DETAIL_REVIEWS_LIMIT,
        page: 1,
      }),
    ]);
    sendSuccess(res, {
      // toHotelDTO already embeds the rooms summary (id/type/price/photo).
      data: {
        ...toHotelDTO(hotel, rating),
        reviews: reviews.map(toPublicReviewDTO),
        reviewsTotal: total,
      },
      message: 'Hotel retrieved successfully',
    });
  },
);
export const getPublicHotel: RequestHandler[] = [
  ...zodValidation.params(intParam('id')),
  handleGetPublicHotel,
];

const handleGetPublicFlights = asyncHandler(
  async (req: Request, res: Response) => {
    const query = req.query as unknown as PublicFlightListQuery;
    const { flights, total } = await listPublicFlights(query);
    const ratings = await ratingSummariesFor(
      'flight',
      flights.map((f) => f.id),
    );
    sendPaginated(res, {
      data: flights.map((flight) =>
        toFlightListItemDTO(flight, ratings.get(flight.id) ?? EMPTY_RATING),
      ),
      limit: query.limit,
      message: 'Flights retrieved successfully',
      page: query.page,
      total,
    });
  },
);
export const getPublicFlights: RequestHandler[] = [
  ...zodValidation.query(publicFlightListQuery),
  handleGetPublicFlights,
];

const handleGetPublicFlight = asyncHandler(
  async (req: Request, res: Response) => {
    const flight = await getFlightById(idParam(req));
    const [rating, { reviews, total }] = await Promise.all([
      ratingSummaryForFlight(flight.id),
      listPublishedForTarget('flight', flight.id, {
        limit: DETAIL_REVIEWS_LIMIT,
        page: 1,
      }),
    ]);
    sendSuccess(res, {
      data: {
        ...toFlightDetailDTO(flight, rating),
        reviews: reviews.map(toPublicReviewDTO),
        reviewsTotal: total,
      },
      message: 'Flight retrieved successfully',
    });
  },
);
export const getPublicFlight: RequestHandler[] = [
  ...zodValidation.params(intParam('id')),
  handleGetPublicFlight,
];

const handleGetRecentReviews = asyncHandler(
  async (req: Request, res: Response) => {
    const query = req.query as unknown as RecentReviewsQuery;
    const reviews = await listRecentPublished(query.limit);
    sendSuccess(res, {
      data: reviews.map(toPublicReviewDTO),
      message: 'Reviews retrieved successfully',
    });
  },
);
export const getRecentReviews: RequestHandler[] = [
  ...zodValidation.query(recentReviewsQuery),
  handleGetRecentReviews,
];
