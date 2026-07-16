import cookieParser from 'cookie-parser';
import cors from 'cors';
// app.ts
import express from 'express';
import morgan from 'morgan';

import ENV from '#config/env.js';
import {
  errorHandler,
  UnauthorizedError,
} from '#middlewares/error-handler.js';
import rateLimiter from '#middlewares/rateLimit.js';
import routes from '#routes/index.js';

const app = express();

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
app.set('trust proxy', true); // Enable trust proxy for proper IP handling behind proxies
app.use(
  morgan(':method :url :status :response-time ms') as express.RequestHandler,
);
app.use(rateLimiter as express.RequestHandler);
app.use('/api/v1', routes);
app.use(errorHandler);

export default app;
