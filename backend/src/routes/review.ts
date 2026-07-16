// src/routes/review.ts
//
// Authenticated review surface. Customers create/update/delete their own
// reviews and list them via /reviews/mine; staff list everything and ADMINs
// moderate (hide/publish) and may delete any review. Ownership rules that
// need the row live in services/review.service.ts.
import { Router } from 'express';

import {
  createReview,
  deleteReview,
  getAllReviews,
  getMyReviews,
  updateReview,
  updateReviewStatus,
} from '#controllers/index.js';
import { authorizeRole } from '#middlewares/authorize-roles.js';
import { UserRole } from '#types/user-profile.types.js';

const reviewRoutes = Router();

reviewRoutes.post(
  '/reviews',
  authorizeRole([UserRole.CUSTOMER]),
  createReview,
);

reviewRoutes.get(
  '/reviews/mine',
  authorizeRole([UserRole.CUSTOMER]),
  getMyReviews,
);

reviewRoutes.get(
  '/reviews',
  authorizeRole([UserRole.ADMIN, UserRole.AGENT]),
  getAllReviews,
);

reviewRoutes.put(
  '/reviews/:id',
  authorizeRole([UserRole.CUSTOMER]),
  updateReview,
);

reviewRoutes.patch(
  '/reviews/:id/status',
  authorizeRole([UserRole.ADMIN]),
  updateReviewStatus,
);

reviewRoutes.delete(
  '/reviews/:id',
  authorizeRole([UserRole.ADMIN, UserRole.CUSTOMER]),
  deleteReview,
);

export default reviewRoutes;
