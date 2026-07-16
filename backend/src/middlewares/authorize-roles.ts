import { NextFunction, Request, Response } from 'express';
import { UserRole } from 'types/user-profile.types';

import { ForbiddenError } from './error-handler';

/**
 * Role-based authorization middleware
 *
 * @param allowedRoles - Array of roles that are permitted to access the route
 * @returns Express middleware function that validates user roles
 * @throws ForbiddenError if user's role is not in the allowed roles
 */
export const authorizeRole =
  (allowedRoles: UserRole[]) =>
  (req: Request, res: Response, next: NextFunction): void => {
    // Verify user object exists
    if (!req.user) {
      throw new ForbiddenError('Unauthorized: User not authenticated');
    }

    // Check if user has required role (a missing role never matches)
    if (!allowedRoles.includes(req.user.role)) {
      throw new ForbiddenError();
    }

    // User is authorized
    next();
  };
