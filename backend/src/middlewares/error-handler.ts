import { NextFunction, Request, Response } from 'express';

import ENV from '#config/env.js';
import { handlePrismaError, isPrismaError } from '#middlewares/prismaErrorHandler.js';
import logger from '#utils/logger.js';

/**
 * Error severity levels for better logging and monitoring
 */
export enum ErrorSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  LOW = 'low',
  MEDIUM = 'medium',
}

/**
 * Enhanced CustomError class with additional context for better debugging
 */
export class CustomError extends Error {
  readonly code?: string;
  readonly context?: Record<string, unknown>;
  readonly layer: string;
  readonly severity: ErrorSeverity;
  readonly status: number;
  readonly timestamp: Date;

  constructor(
    status: number,
    message: string,
    options: {
      code?: string;
      context?: Record<string, unknown>;
      layer?: string;
      severity?: ErrorSeverity;
    } = {},
  ) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    this.layer = options.layer ?? 'unknown';
    this.severity = options.severity ?? ErrorSeverity.MEDIUM;
    this.timestamp = new Date();
    this.code = options.code;
    this.context = options.context;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Type guard to check if an error is a CustomError
 */
const isCustomError = (error: unknown): error is CustomError => {
  return error instanceof CustomError;
};

/**
 * Error response interface for consistent API responses
 */
interface ErrorResponse {
  code?: string;
  details?: Record<string, unknown>;
  errorId?: string;
  message: string;
  status: string;
}

/**
 * Generate a unique error ID for tracking
 */
const generateErrorId = (): string => {
  return `err_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .substring(2, 9)}`;
};

/**
 * Sanitize error data for safe logging and response
 */
const sanitizeErrorData = (data: unknown): unknown => {
  if (!data) return data;

  if (typeof data === 'object') {
    const sanitized: Record<string, unknown> = {};

    Object.entries(data as Record<string, unknown>).forEach(([key, value]) => {
      if (
        ['password', 'token', 'secret', 'auth', 'key', 'credit', 'ssn'].some(
          (k) => key.toLowerCase().includes(k),
        )
      ) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = sanitizeErrorData(value);
      } else {
        sanitized[key] = value;
      }
    });

    return sanitized;
  }

  return data;
};

/**
 * Error handler middleware with full type safety
 */
export const errorHandler = (
  error: CustomError | Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  const isProduction = ENV.NODE_ENV === 'production';
  const errorId = generateErrorId();

  // Convert Prisma errors first
  let processedError: CustomError | Error = error;

  if (isPrismaError(error)) {
    processedError = handlePrismaError(error);
  }

  const sanitizedBody = sanitizeErrorData(req.body);

  // Default values
  let status = 500;
  let severity = ErrorSeverity.HIGH;
  let layer = 'unknown';
  let code: string | undefined;
  let context: Record<string, unknown> | undefined;

  // Safely narrow CustomError type
  if (isCustomError(processedError)) {
    status = processedError.status;
    severity = processedError.severity;
    layer = processedError.layer;
    code = processedError.code;
    context = processedError.context;
  }

  // Logging details
  const logDetails = {
    body: sanitizedBody,
    code,
    context,
    errorId,
    ip: req.ip,
    layer,
    message: processedError.message,
    method: req.method,
    params: req.params,
    path: req.path,
    query: req.query,
    severity,
    stack: !isProduction ? processedError.stack : undefined,
    timestamp: new Date().toISOString(),
  };

  // Log at the appropriate level
  switch (severity) {
    case ErrorSeverity.CRITICAL:
    case ErrorSeverity.HIGH:
      logger.error(logDetails);
      break;
    case ErrorSeverity.LOW:
      logger.info(logDetails);
      break;
    case ErrorSeverity.MEDIUM:
      logger.warn(logDetails);
      break;
    default:
      logger.error(logDetails);
  }

  // Client response
  const errorResponse: ErrorResponse = {
    message:
      isProduction && status === 500
        ? 'Internal Server Error'
        : processedError.message || 'Internal Server Error',
    status: 'error',
  };

  if (context && code === 'VALIDATION_ERROR') {
    errorResponse.details = context;
  }

  if (!isProduction) {
    errorResponse.errorId = errorId;
    if (code) errorResponse.code = code;
    if (context && !errorResponse.details) errorResponse.details = context;
  }

  res.status(status).json(errorResponse);
};

/**
 * Wrapper for async route handlers
 */
export const asyncHandler = <T>(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<T>,
) => {
  return (req: Request, res: Response, next: NextFunction): Promise<void> => {
    return Promise.resolve(fn(req, res, next) as Promise<void>).catch(next);
  };
};

export class BadRequestError extends CustomError {
  constructor(
    message = 'Bad request',
    options?: {
      code?: string;
      context?: Record<string, unknown>;
      layer?: string;
    },
  ) {
    super(400, message, { ...options, severity: ErrorSeverity.LOW });
  }
}

export class ForbiddenError extends CustomError {
  constructor(
    message = 'Access forbidden, you are not allowed to access this resource',
    options?: {
      code?: string;
      context?: Record<string, unknown>;
      layer?: string;
    },
  ) {
    super(403, message, { ...options, severity: ErrorSeverity.MEDIUM });
  }
}

export class InternalServerError extends CustomError {
  constructor(
    message = 'Internal server error',
    options?: {
      code?: string;
      context?: Record<string, unknown>;
      layer?: string;
    },
  ) {
    super(500, message, { ...options, severity: ErrorSeverity.HIGH });
  }
}

/**
 * Common custom error subclasses
 */
export class NotFoundError extends CustomError {
  constructor(
    message = 'Resource not found',
    options?: {
      code?: string;
      context?: Record<string, unknown>;
      layer?: string;
    },
  ) {
    super(404, message, { ...options, severity: ErrorSeverity.LOW });
  }
}

export class ServiceUnavailableError extends CustomError {
  constructor(
    message = 'Service unavailable',
    options?: {
      code?: string;
      context?: Record<string, unknown>;
      layer?: string;
    },
  ) {
    super(503, message, { ...options, severity: ErrorSeverity.MEDIUM });
  }
}

export class TooManyRequestsError extends CustomError {
  constructor(
    message = 'Too many requests',
    options?: {
      code?: string;
      context?: Record<string, unknown>;
      layer?: string;
    },
  ) {
    super(429, message, { ...options, severity: ErrorSeverity.MEDIUM });
  }
}

export class UnauthorizedError extends CustomError {
  constructor(
    message = 'Unauthorized access',
    options?: {
      code?: string;
      context?: Record<string, unknown>;
      layer?: string;
    },
  ) {
    super(401, message, { ...options, severity: ErrorSeverity.MEDIUM });
  }
}

export class ValidationError extends CustomError {
  constructor(
    message = 'Validation failed',
    options?: {
      code?: string;
      context?: Record<string, unknown>;
      layer?: string;
    },
  ) {
    super(400, message, { ...options, severity: ErrorSeverity.LOW });
  }
}
