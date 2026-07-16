// src/lib/soft-delete-extension.ts
//
// A Prisma client extension that transparently scopes reads to non-deleted
// rows for every soft-deletable model, so a new query can never accidentally
// leak soft-deleted records by forgetting a `deletedAt: null` filter.
//
// Design notes (mirrors khadys-kitchen-backend):
//   - Only multi-row / predicate reads are scoped: findMany, findFirst(OrThrow),
//     count, aggregate, groupBy. `findUnique` is intentionally NOT scoped — it
//     looks rows up by a unique key and is the seam the app relies on to find
//     soft-deleted rows on purpose (restore, idempotency).
//   - If a caller already mentions `deletedAt` in its `where`, we respect it
//     (explicit opt-out / opt-in).
//   - Only top-level model reads are scoped. Nested relation filters / includes
//     keep their own explicit `deletedAt` predicates.
//   - Unique constraints (user email/phone, flightNumber, payment
//     transactionReference, ...) still span soft-deleted rows: a deleted row
//     keeps holding its unique value until it is hard-purged or restored.
import { Prisma } from '../../generated/prisma/client.js';

/** Models that carry a `deletedAt` soft-delete column. */
const SOFT_DELETE_MODELS = new Set<string>([
  'Booking',
  'Destination',
  'Flight',
  'Hotel',
  'Payment',
  'Room',
  'Tour',
  'User',
]);

/** Read operations that accept a `where` predicate and may return many rows. */
const SCOPED_OPERATIONS = new Set<string>([
  'aggregate',
  'count',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'groupBy',
]);

export const softDeleteExtension = Prisma.defineExtension({
  name: 'soft-delete-scope',
  query: {
    $allModels: {
      async $allOperations({ args, model, operation, query }) {
        if (
          SOFT_DELETE_MODELS.has(model) &&
          SCOPED_OPERATIONS.has(operation)
        ) {
          const typedArgs = args as { where?: Record<string, unknown> };
          const where = typedArgs.where;

          // Respect an explicit deletedAt predicate (opt-out / opt-in).
          if (!where || !('deletedAt' in where)) {
            typedArgs.where = { ...(where ?? {}), deletedAt: null };
            return query(typedArgs);
          }
        }
        return query(args);
      },
    },
  },
});
