// src/middlewares/validate-request.ts
//
// Zod validation at the route boundary. Replaces the express-validator
// ValidationFactory as domains migrate to the service-layer architecture;
// once every domain is converted, the legacy validation.ts and
// validation-factory.ts are deleted.
import { NextFunction, Request, Response } from 'express';
import { ZodError, ZodType } from 'zod';

import { ValidationError } from './error-handler';

/**
 * Middleware factory for Zod validation.
 *
 * After successful parsing, the coerced/transformed result is written back
 * to req[target] so downstream handlers see typed values rather than raw
 * string-only query params or unvalidated body data.
 *
 * Note on Express 5: req.query is defined as a getter on the IncomingMessage
 * prototype and cannot be reassigned via `req.query = ...`. We use
 * Object.defineProperty to redefine it on the request instance itself.
 */
export const validateRequest =
  (schema: ZodType, target: 'body' | 'params' | 'query' = 'body') =>
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse(req[target]);

      if (target === 'query') {
        // Express 5: req.query is a getter, must redefine the property
        Object.defineProperty(req, 'query', {
          configurable: true,
          enumerable: true,
          value: parsed,
          writable: true,
        });
      } else {
        // body and params are writable on the request instance
        (req as unknown as Record<string, unknown>)[target] = parsed;
      }

      next();
    } catch (err: unknown) {
      if (err instanceof ZodError) {
        const formattedErrors = err.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        }));

        const validationError = new ValidationError('Validation Error', {
          code: 'VALIDATION_ERROR',
          context: {
            errors: formattedErrors,
          },
          layer: 'Request Validation',
        });

        next(validationError);
        return;
      }
      next(err);
    }
  };

/**
 * Middleware factory for common CRUD operations using Zod
 */
export const zodValidation = {
  body: (schema: ZodType) => [validateRequest(schema, 'body')],
  params: (schema: ZodType) => [validateRequest(schema, 'params')],
  query: (schema: ZodType) => [validateRequest(schema, 'query')],
};

export default zodValidation;
