// src/middlewares/validation-middleware.ts
import { NextFunction, Request, Response } from 'express';
import { ValidationError, validationResult } from 'express-validator';

import { ValidationError as CustomValidationError } from '#middlewares/error-handler.js';

/**
 * Middleware to check validation results and pass errors to error handler
 */

function isLegacyValidationError(
  error: ValidationError,
): error is ValidationError & { msg: string; param: string } {
  return 'param' in error;
}

// Type guards
function isStandardValidationError(
  error: ValidationError,
): error is ValidationError & { msg: string; path: string } {
  return 'path' in error;
}

export const validateRequest = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map((error: ValidationError) => {
      if (isStandardValidationError(error)) {
        return { field: error.path, message: error.msg };
      }
      if (isLegacyValidationError(error)) {
        return { field: error.param, message: error.msg };
      }
      return { field: 'unknown', message: error.msg };
    });

    const validationError = new CustomValidationError('Validation Error', {
      code: 'VALIDATION_ERROR',
      context: {
        errors: formattedErrors,
      },
      layer: 'Request Validation',
    });
    next(validationError);
    return;
  }

  next();
};
/**
 * Middleware factory for common CRUD operations
 */
export const validationMiddleware = {
  // Create a middleware with the provided validators
  create: (validators: any[]) => [...validators, validateRequest],

  // Create a middleware for custom operations
  custom: (validators: any[]) => [...validators, validateRequest],

  // Create a middleware for delete operations
  delete: (validators: any[]) => [...validators, validateRequest],

  // Create a middleware for update operations
  update: (validators: any[]) => [...validators, validateRequest],
};

export default validationMiddleware;
