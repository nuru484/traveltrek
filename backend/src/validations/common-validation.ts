// src/validations/common-validation.ts
//
// Shared request-validation building blocks (zod). These replace hand-rolled
// param guards and raw pagination parsing inside controllers, moving both to
// the route boundary where the rest of the codebase validates input.
import { z } from 'zod';

/**
 * Validates a positive-integer route param (this codebase uses autoincrement
 * ids). Pass the param name used in the route (`intParam("id")` for `/:id`) —
 * the coerced result is written back to `req.params`, so handlers read an
 * already-validated number.
 */
export const intParam = (name: string) =>
  z.object({
    [name]: z.coerce
      .number({ error: `A valid ${name} is required` })
      .int(`A valid ${name} is required`)
      .positive(`A valid ${name} is required`),
  });

/**
 * Standard list pagination query params. Coerced from strings, defaulted, and
 * capped so a client can't request an unbounded page size. Extend it
 * per-endpoint for extra filters:
 * `paginationQuery.extend({ status: z.enum(...).optional() })`.
 */
export const paginationQuery = z.object({
  limit: z.coerce.number().int().positive().max(100).default(10),
  page: z.coerce.number().int().positive().default(1),
});

/**
 * Optional created-date window for list endpoints, sent as YYYY-MM-DD.
 * `from` is inclusive from the start of that day, `to` through the end of it,
 * so "from 2026-07-01 to 2026-07-01" means the whole of that day.
 */
export const dateRangeQuery = z.object({
  from: z.iso
    .date()
    .transform((d) => new Date(`${d}T00:00:00.000Z`))
    .optional(),
  to: z.iso
    .date()
    .transform((d) => new Date(`${d}T23:59:59.999Z`))
    .optional(),
});

/** Prisma `createdAt` clause for a parsed date window (undefined when empty). */
export const createdBetween = (
  from?: Date,
  to?: Date,
): undefined | { gte?: Date; lte?: Date } => {
  if (!from && !to) return undefined;
  return { ...(from && { gte: from }), ...(to && { lte: to }) };
};

/** Boolean query param sent as the strings "true" / "false". */
export const boolQuery = z
  .enum(['true', 'false'])
  .transform((v) => v === 'true');
