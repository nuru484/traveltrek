// src/routes/public.ts
//
// UNAUTHENTICATED browse surface for the portfolio landing page, mounted
// under /api/v1/public BEFORE authenticateJWT (see routes/index.ts for the
// public/admin route split). Read-only, rate limited on its own budget, and
// privacy-scoped: see publicController.ts for the boundary.
import { Router } from 'express';

import {
  getPublicDestinations,
  getPublicFlight,
  getPublicFlights,
  getPublicHotel,
  getPublicHotels,
  getPublicTour,
  getPublicTours,
  getRecentReviews,
} from '#controllers/index.js';
import { publicBrowseLimiter } from '#middlewares/rateLimit.js';

const publicRoutes = Router();

// A modest dedicated budget for the anonymous surface (the global limiter
// still applies upstream).
publicRoutes.use(publicBrowseLimiter);

publicRoutes.get('/destinations', getPublicDestinations);

publicRoutes.get('/tours', getPublicTours);
publicRoutes.get('/tours/:id', getPublicTour);

publicRoutes.get('/hotels', getPublicHotels);
publicRoutes.get('/hotels/:id', getPublicHotel);

publicRoutes.get('/flights', getPublicFlights);
publicRoutes.get('/flights/:id', getPublicFlight);

publicRoutes.get('/reviews/recent', getRecentReviews);

export default publicRoutes;
