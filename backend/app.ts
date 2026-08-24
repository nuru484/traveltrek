import cookieParser from 'cookie-parser';
import cors from 'cors';
// app.ts
import express from 'express';
import helmet from 'helmet';

import ENV from '#config/env.js';
import { mountApiDocs } from '#docs/mount.js';
import { accessLog } from '#middlewares/access-log.js';
import {
  errorHandler,
  UnauthorizedError,
} from '#middlewares/error-handler.js';
import rateLimiter from '#middlewares/rateLimit.js';
import { requestId } from '#middlewares/request-id.js';
import healthRoutes from '#routes/health.js';
import routes from '#routes/index.js';

const app = express();

// Correlation first, so every downstream log line and the access log carry the
// same requestId as the response header and any error response.
app.use(requestId);
app.use(accessLog);

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

// Liveness, readiness and the deep database probe, mounted before the rate
// limiter so platform health checks are never throttled.
app.use('/', healthRoutes);

// Public API reference. Mounted before the global rate limiter so a burst of
// docs page views cannot spend a reader's API budget, and before the versioned
// router so the docs are reachable without a session.
mountApiDocs(app);

app.use(rateLimiter as express.RequestHandler);
app.use('/api/v1', routes);
app.use(errorHandler);

export default app;
