import type { Request, Response } from 'express';

import cookieParser from 'cookie-parser';
import cors from 'cors';
// app.ts
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

import ENV from '#config/env.js';
import prisma from '#config/prismaClient.js';
import {
  errorHandler,
  UnauthorizedError,
} from '#middlewares/error-handler.js';
import rateLimiter from '#middlewares/rateLimit.js';
import { requestId } from '#middlewares/request-id.js';
import routes from '#routes/index.js';

const app = express();

// Correlation first, so every downstream log line and the access log carry the
// same requestId as the response header and any error response.
app.use(requestId);

// Security headers (CSP, HSTS, X-Content-Type-Options, frame-guard, etc.).
app.use(helmet());

const allowedOrigins = new Set(
  ENV.CORS_ACCESS ? ENV.CORS_ACCESS.split(',') : [],
);

type CorsCallback = (err: Error | null, allow: boolean) => void;

const corsOptions = {
  allowedHeaders: ['Content-Type', 'Authorization'],

  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE', 'PATCH'],
  origin: function (origin: string | undefined, callback: CorsCallback) {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
    } else {
      callback(
        new UnauthorizedError('Not allowed by CORS', {
          code: 'CORS_NOT_ALLOWED',
          context: { origin },
          layer: 'cors',
        }),
        false,
      );
    }
  },
};

app.use(cors(corsOptions));
// Capture the raw request bytes so the Paystack webhook can verify its HMAC
// signature over the exact wire body (re-serializing req.body is fragile).
app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as express.Request).rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
// Trust exactly one proxy hop (the PaaS load balancer) so req.ip reflects the
// real client for rate limiting. Trusting all proxies (`true`) would let
// clients spoof X-Forwarded-For and bypass IP-based limits.
app.set('trust proxy', 1);
morgan.token('request-id', (req: Request) => req.requestId ?? '-');
app.use(
  morgan(
    ':method :url :status :response-time ms :request-id',
  ) as express.RequestHandler,
);

// Liveness + readiness probes, mounted before the rate limiter so platform
// health checks are never throttled. Liveness is a cheap static response.
// Readiness verifies the database ONCE (first probe after boot) and then
// answers statically, so a poller can't keep an auto-suspending database awake.
// /health/db remains for on-demand deep checks meant to wake the database.
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});
let dbVerifiedAtBoot = false;
app.get('/health/ready', async (_req: Request, res: Response) => {
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
app.get('/health/db', async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'ok' });
  } catch {
    res.status(503).json({ status: 'unreachable' });
  }
});

app.use(rateLimiter as express.RequestHandler);
app.use('/api/v1', routes);
app.use(errorHandler);

export default app;
