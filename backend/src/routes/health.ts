// src/routes/health.ts
//
// Liveness + readiness probes, mounted before the rate limiter so platform
// health checks are never throttled.
//   - /health        liveness: process is up (static, no I/O).
//   - /health/ready  readiness: verifies the database ONCE (first probe after
//                    boot) and then answers statically - a poller running
//                    SELECT 1 on every probe keeps an auto-suspending Postgres
//                    compute awake 24/7, defeating the suspend.
//   - /health/db     on-demand deep DB check that is MEANT to hit the database.
import { Router } from 'express';

import prisma from '#config/prismaClient.js';

const healthRoutes = Router();

healthRoutes.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

let dbVerifiedAtBoot = false;
healthRoutes.get('/health/ready', async (_req, res) => {
  if (!dbVerifiedAtBoot) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbVerifiedAtBoot = true;
    } catch {
      res.status(503).json({ status: 'not ready' });
      return;
    }
  }
  res.status(200).json({ status: 'ready' });
});

healthRoutes.get('/health/db', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ database: 'up', status: 'ok' });
  } catch {
    res.status(503).json({ database: 'down', status: 'unreachable' });
  }
});

healthRoutes.get('/', (_req, res) => {
  res.status(200).json({ message: 'TravelTrek API', success: true });
});

/** Test-only: force the next /health/ready probe to re-verify the database. */
export const _resetReadinessForTests = (): void => {
  dbVerifiedAtBoot = false;
};

export default healthRoutes;
