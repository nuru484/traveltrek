// src/config/env.ts
//
// Typed, fail-fast environment access. Every variable is read exactly once,
// through a reader that validates its SHAPE, not just its presence - a
// mistyped PORT or SMTP_PORT dies at boot with the variable named instead of
// silently falling back to a default mid-request. The ENV object's type is
// inferred from the readers (required -> string, optional -> string |
// undefined), so there is no separate interface to keep in sync. App code
// imports ENV and never touches process.env (the one documented exception is
// prismaClient.ts, which seeds/scripts import without the full app env).

/**
 * Reads a boolean environment variable. Absent or empty applies the default;
 * anything other than exactly "true"/"false" throws so a typo ("1", "TRUE")
 * fails at startup instead of silently meaning false.
 */
function envBool(name: string, defaultValue = false): boolean {
  const v = process.env[name];
  if (!v?.length) return defaultValue;
  if (v !== 'true' && v !== 'false') {
    throw new Error(
      `Invalid boolean for env variable ${name}: "${v}". Use "true" or "false".`,
    );
  }
  return v === 'true';
}

/**
 * Reads a numeric environment variable.
 * - If a defaultValue is provided, it acts as an optional numeric var.
 * - If no defaultValue is provided, the variable is treated as required.
 * Throws on NaN so bad values (e.g. "abc") don't silently produce a fallback.
 */
function envNumber(name: string, defaultValue?: number): number {
  const v = process.env[name];
  if (!v?.length) {
    if (defaultValue !== undefined) return defaultValue;
    throw new Error(`Missing required env variable: ${name}`);
  }
  const parsed = Number(v);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid number for env variable: ${name}`);
  }
  return parsed;
}

/**
 * Reads an optional environment variable. Returns undefined (rather than an
 * empty string) when the variable is absent or set to "", keeping downstream
 * consumers clean.
 */
function envOptional(name: string): string | undefined {
  const v = process.env[name];
  return v?.length ? v : undefined;
}

/**
 * Reads a required environment variable. Throws at startup if the variable is
 * missing or empty, so misconfigured deployments fail fast rather than at
 * runtime.
 */
function envRequired(name: string): string {
  const v = process.env[name];
  if (!v?.length) throw new Error(`Missing required env variable: ${name}`);
  return v;
}

const NODE_ENV = envOptional('NODE_ENV') ?? 'development';

const ENV = {
  ACCESS_TOKEN_EXPIRY: envOptional('ACCESS_TOKEN_EXPIRY') ?? '30m',
  ACCESS_TOKEN_SECRET: envRequired('ACCESS_TOKEN_SECRET'),
  /** ADMIN_*: read ONLY by `npm run seed` (which asserts them itself), so
   * they are optional here - the API/worker boot without them and
   * production never needs the admin credentials in its env store. */
  ADMIN_EMAIL: envOptional('ADMIN_EMAIL'),
  ADMIN_NAME: envOptional('ADMIN_NAME'),
  ADMIN_PASSWORD: envOptional('ADMIN_PASSWORD'),
  ADMIN_PHONE: envOptional('ADMIN_PHONE'),
  /** Gate for `npm run seed`: false (default) makes the seed a no-op. */
  ADMIN_SEED_ENABLED: envBool('ADMIN_SEED_ENABLED'),
  /** false (default) = create-only seed; true also overwrites an existing
   * admin with the current ADMIN_* values (credential rotation). */
  ADMIN_SEED_FORCE_UPDATE: envBool('ADMIN_SEED_FORCE_UPDATE'),
  CLOUDINARY_API_KEY: envRequired('CLOUDINARY_API_KEY'),
  CLOUDINARY_API_SECRET: envRequired('CLOUDINARY_API_SECRET'),
  CLOUDINARY_CLOUD_NAME: envRequired('CLOUDINARY_CLOUD_NAME'),
  COOKIE_DOMAIN: envOptional('COOKIE_DOMAIN'),
  CORS_ACCESS: envOptional('CORS_ACCESS'),
  DATABASE_URL: envRequired('DATABASE_URL'),
  /** DEMO_*: server-side demo login. DEMO_LOGIN_ENABLED (default false) gates
   * POST /auth/demo-login entirely (403 when off). When on, each role resolves
   * a real account by these emails — ADMIN/AGENT are staff Users,
   * DEMO_CUSTOMER_EMAIL is a Customer. AGENT/CUSTOMER default to fixed
   * seed-owned addresses so `npm run seed` (with the seed flag on) wires them
   * up with zero config; the same defaults are what demo-login looks up here.
   * DEMO_ADMIN_EMAIL has no default: the demo admin IS the seeded admin, so
   * point it at ADMIN_EMAIL (an unset/unseeded email just 404s that role).
   * Never NEXT_PUBLIC_* — no credentials ever reach the client. */
  DEMO_ADMIN_EMAIL:
    envOptional('DEMO_ADMIN_EMAIL') ?? 'abdulmajeednurudeen47@gmail.com',
  DEMO_AGENT_EMAIL:
    envOptional('DEMO_AGENT_EMAIL') ?? 'demo.agent@traveltrek.app',
  DEMO_CUSTOMER_EMAIL:
    envOptional('DEMO_CUSTOMER_EMAIL') ?? 'demo.customer@traveltrek.app',
  DEMO_LOGIN_ENABLED: envBool('DEMO_LOGIN_ENABLED'),
  /** Frog (Wigal) SMS credentials - all three unset means log-only SMS. */
  FROG_API_KEY: envOptional('FROG_API_KEY'),
  FROG_SENDER_ID: envOptional('FROG_SENDER_ID'),
  FROG_USERNAME: envOptional('FROG_USERNAME'),
  /** Base URL embedded in emailed links (password reset). */
  FRONTEND_URL: envOptional('FRONTEND_URL') ?? 'http://localhost:3000',
  /** OAuth client id for Google sign-in; unset disables the endpoint (503). */
  GOOGLE_CLIENT_ID: envOptional('GOOGLE_CLIENT_ID'),
  MAIL_FROM_EMAIL:
    envOptional('MAIL_FROM_EMAIL') ?? 'no-reply@traveltrek.local',
  MAIL_FROM_NAME: envOptional('MAIL_FROM_NAME') ?? 'TravelTrek',
  NODE_ENV,
  /**
   * true sends email/SMS directly (fire-and-forget, no retries) instead of
   * through the durable BullMQ notification queue. For tests and Redis-less
   * local runs only - production should keep the queued default.
   */
  NOTIFICATIONS_INLINE: envBool('NOTIFICATIONS_INLINE'),
  /** Override for Paystack's API host (tests/sandboxes). */
  PAYSTACK_API_BASE_URL:
    envOptional('PAYSTACK_API_BASE_URL') ?? 'https://api.paystack.co',
  PAYSTACK_CALLBACK_URL: envOptional('PAYSTACK_CALLBACK_URL'),
  PAYSTACK_SECRET_KEY: envRequired('PAYSTACK_SECRET_KEY'),
  PORT: envNumber('PORT', 3000),
  /** Internal bypass for the rate limiter (header X-Rate-Limit-Bypass).
   * Unset means no bypass exists - fail closed. */
  RATE_LIMIT_BYPASS_SECRET: envOptional('RATE_LIMIT_BYPASS_SECRET'),
  REDIS_URL: envRequired('REDIS_URL'),
  REFRESH_TOKEN_EXPIRY: envOptional('REFRESH_TOKEN_EXPIRY') ?? '7d',
  REFRESH_TOKEN_SECRET: envRequired('REFRESH_TOKEN_SECRET'),
  /** Error tracking (Sentry). Optional: unset disables reporting entirely. */
  SENTRY_DSN: envOptional('SENTRY_DSN'),
  /** Environment tag on Sentry events; defaults to NODE_ENV. */
  SENTRY_ENVIRONMENT: envOptional('SENTRY_ENVIRONMENT') ?? NODE_ENV,
  /** Performance-tracing sample rate 0-1; default 0 (errors only). */
  SENTRY_TRACES_SAMPLE_RATE: envNumber('SENTRY_TRACES_SAMPLE_RATE', 0),
  /** SMTP_HOST unset means the mailer logs instead of sending (dev-friendly). */
  SMTP_HOST: envOptional('SMTP_HOST'),
  SMTP_PASSWORD: envOptional('SMTP_PASSWORD'),
  SMTP_PORT: envNumber('SMTP_PORT', 587),
  SMTP_SECURE: envBool('SMTP_SECURE'),
  SMTP_USER: envOptional('SMTP_USER'),
  /**
   * Workers run in-process with the web server by default (saves a dyno).
   * Set to true on the WEB process only when a dedicated worker process runs
   * `build/worker.js`, so jobs are never processed twice.
   */
  WEB_DISABLE_WORKERS: envBool('WEB_DISABLE_WORKERS'),
} as const;

export default ENV;
