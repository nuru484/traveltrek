// src/config/prismaClient.ts
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../../generated/prisma/client.js';
import { softDeleteExtension } from '../lib/soft-delete-extension.js';

const connectionString = process.env.DATABASE_URL ?? '';

// Explicit pool cap (pg defaults to 10). process.env (not the app ENV
// module) on purpose: this module is imported by seeds/scripts that don't
// carry the full fail-fast app env.
const poolMax = Number(process.env.DB_POOL_MAX ?? 20);

const adapter = new PrismaPg({ connectionString, max: poolMax });

// Reads on soft-deletable models are auto-scoped to non-deleted rows by the
// extension (see soft-delete-extension.ts). `$extends` returns a new client;
// the whole app imports this extended instance.
const prisma = new PrismaClient({ adapter }).$extends(softDeleteExtension);

export default prisma;

/**
 * Interactive-transaction client for the (soft-delete-)extended Prisma client.
 * Use this instead of `Prisma.TransactionClient` for helpers that accept a `tx`,
 * so the extension's query scoping is preserved through the type system.
 */
export type TransactionClient = Omit<
  typeof prisma,
  '$connect' | '$disconnect' | '$extends' | '$on' | '$transaction' | '$use'
>;

export * from '../../generated/prisma/client.js';
