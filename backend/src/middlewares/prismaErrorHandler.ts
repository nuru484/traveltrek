// middleware/prismaErrorHandler.ts
import { Prisma } from '../../generated/prisma/client';
import { CustomError, ErrorSeverity } from './error-handler';

/**
 * Prisma-specific error codes mapping to user-friendly messages
 */
const PRISMA_ERROR_MESSAGES: Record<string, string> = {
  P2002: 'A record with this information already exists',
  P2003: 'Related record not found',
  P2025: 'Record not found',
  P2014: 'The change would violate a required relation',
  P2000: 'Value is too long for the column',
  P2001: 'Record does not exist',
  P2011: 'Null constraint violation',
  P2012: 'Missing required value',
  P2015: 'Related record not found',
  P2016: 'Query interpretation error',
  P2017: 'Records for relation are not connected',
  P2018: 'Required connected records not found',
  P2019: 'Input error',
  P2020: 'Value out of range',
  P2021: 'Table does not exist',
  P2022: 'Column does not exist',
  P2023: 'Inconsistent column data',
  P2024: 'Timed out fetching connection',
  P2026: 'Unsupported database feature',
  P2027: 'Multiple database errors occurred',
};

/**
 * Type guard to check if an object has a specific property
 */
const hasProperty = <K extends string>(
  obj: unknown,
  key: K,
): obj is Record<K, unknown> => {
  return typeof obj === 'object' && obj !== null && key in obj;
};

/**
 * Check if error is a Prisma error
 */
export const isPrismaError = (error: unknown): boolean => {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError ||
    error instanceof Prisma.PrismaClientValidationError ||
    error instanceof Prisma.PrismaClientInitializationError ||
    error instanceof Prisma.PrismaClientRustPanicError ||
    (hasProperty(error, 'constructor') &&
      hasProperty(error.constructor, 'name') &&
      typeof error.constructor.name === 'string' &&
      error.constructor.name.startsWith('PrismaClient')) ||
    (hasProperty(error, 'name') &&
      typeof error.name === 'string' &&
      error.name.startsWith('PrismaClient'))
  );
};

/**
 * Extract field names from Prisma error meta
 */
const extractFieldNames = (
  meta: Record<string, unknown> | undefined,
): string[] => {
  if (!meta) return [];

  if (hasProperty(meta, 'target') && Array.isArray(meta.target)) {
    return meta.target.filter(
      (item): item is string => typeof item === 'string',
    );
  }

  if (hasProperty(meta, 'field_name') && typeof meta.field_name === 'string') {
    return [meta.field_name];
  }

  return [];
};

/**
 * Create a user-friendly field name from database column name
 */
const formatFieldName = (field: string): string => {
  return field
    .replace(/([A-Z])/g, ' $1') // Add space before capital letters
    .replace(/_/g, ' ') // Replace underscores with spaces
    .toLowerCase()
    .trim();
};

/**
 * Handle Prisma unique constraint errors (P2002)
 */
const handleUniqueConstraintError = (
  error: Prisma.PrismaClientKnownRequestError,
): CustomError => {
  const fields = extractFieldNames(
    error.meta as Record<string, unknown> | undefined,
  );
  const formattedFields = fields.map(formatFieldName).join(', ');

  let message = 'A record with this information already exists';

  if (fields.length > 0) {
    if (fields.includes('email')) {
      message = 'An account with this email already exists';
    } else if (fields.includes('username')) {
      message = 'This username is already taken';
    } else if (fields.includes('userId') && fields.includes('flightId')) {
      message = 'You have already booked this flight';
    } else if (fields.includes('phoneNumber')) {
      message = 'This phone number is already registered';
    } else {
      message = `A record with this ${formattedFields} already exists`;
    }
  }

  return new CustomError(409, message, {
    layer: 'database',
    severity: ErrorSeverity.LOW,
    code: 'DUPLICATE_RECORD',
    context: {
      fields: fields,
      prismaCode: error.code,
    },
  });
};

/**
 * Handle Prisma foreign key constraint errors (P2003)
 */
const handleForeignKeyError = (
  error: Prisma.PrismaClientKnownRequestError,
): CustomError => {
  const fields = extractFieldNames(
    error.meta as Record<string, unknown> | undefined,
  );
  const formattedFields = fields.map(formatFieldName).join(', ');

  const message =
    fields.length > 0
      ? `The referenced ${formattedFields} does not exist`
      : 'Referenced record not found';

  return new CustomError(400, message, {
    layer: 'database',
    severity: ErrorSeverity.LOW,
    code: 'INVALID_REFERENCE',
    context: {
      fields: fields,
      prismaCode: error.code,
    },
  });
};

/**
 * Handle Prisma record not found errors (P2025)
 */
const handleRecordNotFoundError = (
  error: Prisma.PrismaClientKnownRequestError,
): CustomError => {
  const message = 'The requested record was not found';

  const meta = error.meta as Record<string, unknown> | undefined;
  const cause = meta && hasProperty(meta, 'cause') ? meta.cause : undefined;

  return new CustomError(404, message, {
    layer: 'database',
    severity: ErrorSeverity.LOW,
    code: 'RECORD_NOT_FOUND',
    context: {
      prismaCode: error.code,
      cause: cause,
    },
  });
};

/**
 * Handle Prisma null constraint errors (P2011)
 */
const handleNullConstraintError = (
  error: Prisma.PrismaClientKnownRequestError,
): CustomError => {
  const fields = extractFieldNames(
    error.meta as Record<string, unknown> | undefined,
  );
  const formattedFields = fields.map(formatFieldName).join(', ');

  const message =
    fields.length > 0
      ? `The field '${formattedFields}' is required and cannot be empty`
      : 'A required field is missing';

  return new CustomError(400, message, {
    layer: 'database',
    severity: ErrorSeverity.LOW,
    code: 'REQUIRED_FIELD_MISSING',
    context: {
      fields: fields,
      prismaCode: error.code,
    },
  });
};

/**
 * Handle Prisma value too long errors (P2000)
 */
const handleValueTooLongError = (
  error: Prisma.PrismaClientKnownRequestError,
): CustomError => {
  const fields = extractFieldNames(
    error.meta as Record<string, unknown> | undefined,
  );
  const formattedFields = fields.map(formatFieldName).join(', ');

  const message =
    fields.length > 0
      ? `The value for '${formattedFields}' is too long`
      : 'One or more values exceed the maximum length';

  return new CustomError(400, message, {
    layer: 'database',
    severity: ErrorSeverity.LOW,
    code: 'VALUE_TOO_LONG',
    context: {
      fields: fields,
      prismaCode: error.code,
    },
  });
};

/**
 * Main Prisma error handler - transforms Prisma errors into CustomErrors
 * This function ALWAYS returns a CustomError (never throws)
 */
export const handlePrismaError = (error: unknown): CustomError => {
  // Handle known Prisma errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        return handleUniqueConstraintError(error);
      case 'P2003':
        return handleForeignKeyError(error);
      case 'P2025':
        return handleRecordNotFoundError(error);
      case 'P2011':
      case 'P2012':
        return handleNullConstraintError(error);
      case 'P2000':
        return handleValueTooLongError(error);
      default:
        // Generic known error handler
        const message =
          PRISMA_ERROR_MESSAGES[error.code] || 'Database operation failed';
        return new CustomError(400, message, {
          layer: 'database',
          severity: ErrorSeverity.MEDIUM,
          code: 'DATABASE_ERROR',
          context: {
            prismaCode: error.code,
            meta: error.meta,
          },
        });
    }
  }

  // Handle validation errors
  if (error instanceof Prisma.PrismaClientValidationError) {
    console.log(error);
    return new CustomError(400, 'Invalid data provided', {
      layer: 'database',
      severity: ErrorSeverity.LOW,
      code: 'VALIDATION_ERROR',
    });
  }

  // Handle initialization errors
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return new CustomError(503, 'Database connection failed', {
      layer: 'database',
      severity: ErrorSeverity.CRITICAL,
      code: 'DB_CONNECTION_ERROR',
    });
  }

  // Handle Rust panic errors
  if (error instanceof Prisma.PrismaClientRustPanicError) {
    return new CustomError(500, 'A critical database error occurred', {
      layer: 'database',
      severity: ErrorSeverity.CRITICAL,
      code: 'DB_CRITICAL_ERROR',
    });
  }

  // Fallback for unhandled Prisma errors - still return CustomError
  return new CustomError(500, 'An unexpected database error occurred', {
    layer: 'database',
    severity: ErrorSeverity.HIGH,
    code: 'UNKNOWN_DB_ERROR',
  });
};

/**
 * Wrapper for Prisma operations with automatic error handling
 * (Optional - you can use this in controllers if you want explicit handling)
 */
export const prismaErrorWrapper = async <T>(
  operation: () => Promise<T>,
): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    throw handlePrismaError(error);
  }
};
