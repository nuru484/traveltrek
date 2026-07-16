// src/config/prismaClient.ts
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../../generated/prisma/client.js';

const connectionString = process.env.DATABASE_URL ?? '';

// Explicit pool cap (pg defaults to 10). process.env (not the app ENV
// module) on purpose: this module is imported by seeds/scripts that don't
// carry the full fail-fast app env.
const poolMax = Number(process.env.DB_POOL_MAX ?? 20);

const adapter = new PrismaPg({ connectionString, max: poolMax });

const prisma = new PrismaClient({ adapter });

export default prisma;

export * from '../../generated/prisma/client.js';
