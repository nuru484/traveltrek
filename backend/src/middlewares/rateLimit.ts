import { NextFunction, Request, Response } from 'express';
import rateLimit, {
  ipKeyGenerator,
  RateLimitRequestHandler,
  Store,
} from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';

import ENV from '#config/env.js';
import { getRedisClient } from '#lib/redis.js';
import { CustomError, ErrorSeverity } from '#middlewares/error-handler.js';

// Custom rate limit exceeded error
export class RateLimitExceededError extends CustomError {
  constructor(message = 'Rate limit exceeded') {
    super(429, message, {
      code: 'RATE_LIMIT_EXCEEDED',
      layer: 'middleware',
      severity: ErrorSeverity.MEDIUM,
    });
  }
}

/**
 * Counter store shared across instances: Redis when the shared client exists
 * (production/dev), express-rate-limit's in-memory default otherwise (tests,
 * Redis-less local runs). Each limiter gets its own key prefix so the auth
 * and global windows never collide on one IP.
 */
const createStore = (prefix: string): Store | undefined => {
  const client = getRedisClient();
  if (!client) return undefined;
  return new RedisStore({
    prefix,
    sendCommand: (command: string, ...args: string[]) =>
      client.call(command, ...args) as Promise<number | string>,
  });
};

// Rate limiter factory: Redis-backed counters, memory fallback.
export const createRateLimiter = (
  windowMs: number = 15 * 60 * 1000,
  maxRequests = 100,
  message = 'Too many requests, please try again later.',
  options: { prefix?: string; skipSuccessfulRequests?: boolean } = {},
): RateLimitRequestHandler => {
  return rateLimit({
    // Custom handler for rate limit exceeded
    handler: (_req: Request, res: Response, next: NextFunction) => {
      const retryAfter = Math.ceil(windowMs / 1000);
      res.set('Retry-After', String(retryAfter));
      next(new RateLimitExceededError(message));
    },

    // Advanced key generation - combine IP with user ID when available
    keyGenerator: (req: Request): string => {
      const ipKey = ipKeyGenerator(req.ip ?? ''); // Use ipKeyGenerator for normalized IP
      const userId = req.user?.id ? `-user-${req.user.id}` : '';
      return `${ipKey}${userId}`;
    },
    legacyHeaders: false,
    max: maxRequests,
    message,
    // A Redis hiccup must degrade limiting, not take the API down: requests
    // pass while the store is unreachable.
    passOnStoreError: true,
    // Skip rate limiting for certain requests
    skip: (req: Request) => {
      // The integration suite fires hundreds of requests from one IP
      if (ENV.NODE_ENV === 'test') return true;

      // Skip health checks (liveness /health, readiness /health/ready and the
      // deep /health/db probe) so platform pollers are never throttled.
      if (req.path === '/health' || req.path.startsWith('/health/')) {
        return true;
      }
      if (req.path === '/ping') return true;

      // Skip for internal requests with secret header. Fail closed: with no
      // secret configured there is no bypass (an absent header must never
      // match an absent secret).
      const secret = ENV.RATE_LIMIT_BYPASS_SECRET;
      const bypassToken = req.get('X-Rate-Limit-Bypass');
      return Boolean(secret) && bypassToken === secret;
    },

    // When set, only FAILED requests count toward the limit — the right shape
    // for brute-force protection: a legitimate user signing in all day never
    // locks themselves out, while a password-guesser still hits the wall.
    skipSuccessfulRequests: options.skipSuccessfulRequests ?? false,

    standardHeaders: true,

    store: createStore(options.prefix ?? 'rl:'),

    windowMs,

    // Enable trust proxy on your Express app instance for proper IP handling behind proxies
    // (Set app.set('trust proxy', true) in your main server file)
  });
};

// Brute-force cap for the credential endpoints (login / register / refresh).
// Successful sign-ins don't count — only failures feed the limit.
export const authRateLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  10, // 10 failed attempts
  'Too many failed attempts, please try again later.',
  { prefix: 'rl:auth:', skipSuccessfulRequests: true },
);

// Different limiters for different endpoints
export const rateLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  100, // 100 requests
  'Too many authentication attempts, please try again later.',
  { prefix: 'rl:global:' },
);

// The unauthenticated /public browse surface: generous enough for a landing
// page session, tight enough to bound anonymous scraping.
export const publicBrowseLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  300, // 300 requests
  'Too many requests, please try again later.',
  { prefix: 'rl:public:' },
);

export const passwordResetLimiter = createRateLimiter(
  60 * 60 * 1000, // 1 hour
  5, // 5 requests
  'Too many password reset attempts, please try again later.',
  { prefix: 'rl:reset:' },
);

export default rateLimiter;
