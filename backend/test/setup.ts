// test/setup.ts
//
// Per-worker setup. Truncates every table before each test so cases are fully
// isolated, and disconnects Prisma when the worker is done.
import { afterAll, beforeEach, vi } from 'vitest';

import prisma from '#config/prismaClient.js';
import { clearAuthzCaches } from '#utils/authz-cache.js';

// Fake Cloudinary so uploads never hit the network. Each upload mints a unique
// fake secure_url; deleteImage records what was reclaimed so tests can assert
// cleanup behaviour.
vi.mock('#config/claudinary.js', () => {
  let uploadCount = 0;
  return {
    cloudinaryService: {
      deleteImage: vi.fn(() => Promise.resolve({ result: 'ok' })),
      uploadImage: vi.fn(() => {
        uploadCount += 1;
        return Promise.resolve({
          asset_id: `asset-${String(uploadCount)}`,
          format: 'png',
          public_id: `traveltrek/test/upload-${String(uploadCount)}`,
          resource_type: 'image',
          secure_url: `https://res.cloudinary.com/test/image/upload/v1/traveltrek/test/upload-${String(uploadCount)}.png`,
        });
      }),
    },
  };
});

// Capture outbound email/SMS instead of hitting SMTP/Frog. Tests read OTP
// codes and reset links out of the recorded messages (see
// test/helpers/messages.ts).
vi.mock('#lib/mail.js', () => ({
  sendMail: vi.fn(() => Promise.resolve()),
}));
vi.mock('#lib/sms.js', () => ({
  sendSms: vi.fn(() => Promise.resolve()),
}));

// No test may hit the real network. Paystack calls go through axios; tests
// that exercise payments must set explicit mock behaviour on these fns.
vi.mock('axios', () => {
  const axiosMock = {
    delete: vi.fn(() => Promise.reject(new Error('axios mocked: set per-test behaviour'))),
    get: vi.fn(() => Promise.reject(new Error('axios mocked: set per-test behaviour'))),
    post: vi.fn(() => Promise.reject(new Error('axios mocked: set per-test behaviour'))),
    put: vi.fn(() => Promise.reject(new Error('axios mocked: set per-test behaviour'))),
  };
  return { default: axiosMock, ...axiosMock };
});

// Silence application logging during tests. `child` returns the same silent
// logger so per-request child loggers (request-id middleware) stay quiet too.
vi.mock('#utils/logger.js', () => {
  const silentLogger = {
    child: vi.fn((): unknown => silentLogger),
    debug: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    info: vi.fn(),
    trace: vi.fn(),
    warn: vi.fn(),
  };
  return { default: silentLogger };
});

let cachedTables: null | string[] = null;

export async function resetDatabase(): Promise<void> {
  const tables = await getTables();
  if (tables.length === 0) return;
  const list = tables.map((t) => `"public"."${t}"`).join(', ');
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`,
  );
}

async function getTables(): Promise<string[]> {
  if (cachedTables) return cachedTables;
  const rows = await prisma.$queryRawUnsafe<{ tablename: string }[]>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE '_prisma%'`,
  );
  cachedTables = rows.map((r) => r.tablename);
  return cachedTables;
}

beforeEach(async () => {
  await resetDatabase();
  // TRUNCATE ... RESTART IDENTITY reuses user ids across tests, so the
  // session-epoch cache from a previous test would poison this one.
  clearAuthzCaches();
});

afterAll(async () => {
  await prisma.$disconnect();
});
