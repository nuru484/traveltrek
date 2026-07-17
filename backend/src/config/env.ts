interface IENV {
  ACCESS_TOKEN_EXPIRY: string;
  ACCESS_TOKEN_SECRET: string;
  /** ADMIN_*: read ONLY by `npm run seed` (which asserts them itself), so
   * they are optional here — the API/worker boot without them and
   * production never needs the admin credentials in its env store. */
  ADMIN_EMAIL?: string;
  ADMIN_NAME?: string;
  ADMIN_PASSWORD?: string;
  ADMIN_PHONE?: string;
  /** Gate for `npm run seed`: false (default) makes the seed a no-op. */
  ADMIN_SEED_ENABLED: boolean;
  /** false (default) = create-only seed; true also overwrites an existing
   * admin with the current ADMIN_* values (credential rotation). */
  ADMIN_SEED_FORCE_UPDATE: boolean;
  CLOUDINARY_API_KEY: string;
  CLOUDINARY_API_SECRET: string;
  CLOUDINARY_CLOUD_NAME: string;
  COOKIE_DOMAIN?: string;
  CORS_ACCESS?: string;
  DATABASE_URL: string;
  /** Frog (Wigal) SMS credentials — all three unset means log-only SMS. */
  FROG_API_KEY?: string;
  FROG_SENDER_ID?: string;
  FROG_USERNAME?: string;
  /** Base URL embedded in emailed links (password reset). */
  FRONTEND_URL: string;
  /** OAuth client id for Google sign-in; unset disables the endpoint (503). */
  GOOGLE_CLIENT_ID?: string;
  MAIL_FROM_EMAIL: string;
  MAIL_FROM_NAME: string;
  NODE_ENV: string;
  /**
   * true sends email/SMS directly (fire-and-forget, no retries) instead of
   * through the durable BullMQ notification queue. For tests and Redis-less
   * local runs only — production should keep the queued default.
   */
  NOTIFICATIONS_INLINE: boolean;
  PAYSTACK_CALLBACK_URL?: string;
  PAYSTACK_SECRET_KEY: string;
  PORT: number;
  REDIS_URL: string;
  REFRESH_TOKEN_EXPIRY: string;
  REFRESH_TOKEN_SECRET: string;
  /** Error tracking (Sentry). Optional: unset disables reporting entirely. */
  SENTRY_DSN?: string;
  /** Environment tag on Sentry events; defaults to NODE_ENV. */
  SENTRY_ENVIRONMENT: string;
  /** Performance-tracing sample rate 0–1; default 0 (errors only). */
  SENTRY_TRACES_SAMPLE_RATE: number;
  /** SMTP_HOST unset means the mailer logs instead of sending (dev-friendly). */
  SMTP_HOST?: string;
  SMTP_PASSWORD?: string;
  SMTP_PORT: number;
  SMTP_SECURE: boolean;
  SMTP_USER?: string;
  /**
   * Workers run in-process with the web server by default (saves a dyno).
   * Set to true on the WEB process only when a dedicated worker process runs
   * `build/worker.js`, so jobs are never processed twice.
   */
  WEB_DISABLE_WORKERS: boolean;
}

export function assertEnv<T>(value: T | undefined, name: string): T {
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const ENV: IENV = {
  ACCESS_TOKEN_EXPIRY: process.env.ACCESS_TOKEN_EXPIRY ?? '30m',
  ACCESS_TOKEN_SECRET: assertEnv(
    process.env.ACCESS_TOKEN_SECRET,
    'ACCESS_TOKEN_SECRET',
  ),
  ADMIN_EMAIL: process.env.ADMIN_EMAIL,
  ADMIN_NAME: process.env.ADMIN_NAME,
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
  ADMIN_PHONE: process.env.ADMIN_PHONE,
  ADMIN_SEED_ENABLED: process.env.ADMIN_SEED_ENABLED === 'true',
  ADMIN_SEED_FORCE_UPDATE: process.env.ADMIN_SEED_FORCE_UPDATE === 'true',
  CLOUDINARY_API_KEY: assertEnv(
    process.env.CLOUDINARY_API_KEY,
    'CLOUDINARY_API_KEY',
  ),
  CLOUDINARY_API_SECRET: assertEnv(
    process.env.CLOUDINARY_API_SECRET,
    'CLOUDINARY_API_SECRET',
  ),
  CLOUDINARY_CLOUD_NAME: assertEnv(
    process.env.CLOUDINARY_CLOUD_NAME,
    'CLOUDINARY_CLOUD_NAME',
  ),
  COOKIE_DOMAIN: process.env.COOKIE_DOMAIN,
  CORS_ACCESS: process.env.CORS_ACCESS,
  DATABASE_URL: assertEnv(process.env.DATABASE_URL, 'DATABASE_URL'),
  FROG_API_KEY: process.env.FROG_API_KEY,
  FROG_SENDER_ID: process.env.FROG_SENDER_ID,
  FROG_USERNAME: process.env.FROG_USERNAME,
  FRONTEND_URL: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  MAIL_FROM_EMAIL: process.env.MAIL_FROM_EMAIL ?? 'no-reply@traveltrek.local',
  MAIL_FROM_NAME: process.env.MAIL_FROM_NAME ?? 'TravelTrek',
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  NOTIFICATIONS_INLINE: process.env.NOTIFICATIONS_INLINE === 'true',
  PAYSTACK_CALLBACK_URL: process.env.PAYSTACK_CALLBACK_URL,
  PAYSTACK_SECRET_KEY: assertEnv(
    process.env.PAYSTACK_SECRET_KEY,
    'PAYSTACK_SECRET_KEY',
  ),
  PORT: Number(process.env.PORT) || 3000,
  REDIS_URL: assertEnv(process.env.REDIS_URL, 'REDIS_URL'),
  REFRESH_TOKEN_EXPIRY: process.env.REFRESH_TOKEN_EXPIRY ?? '7d',
  REFRESH_TOKEN_SECRET: assertEnv(
    process.env.REFRESH_TOKEN_SECRET,
    'REFRESH_TOKEN_SECRET',
  ),
  SENTRY_DSN: process.env.SENTRY_DSN,
  SENTRY_ENVIRONMENT:
    process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development',
  SENTRY_TRACES_SAMPLE_RATE: Number(process.env.SENTRY_TRACES_SAMPLE_RATE) || 0,
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PASSWORD: process.env.SMTP_PASSWORD,
  SMTP_PORT: Number(process.env.SMTP_PORT) || 587,
  SMTP_SECURE: process.env.SMTP_SECURE === 'true',
  SMTP_USER: process.env.SMTP_USER,
  WEB_DISABLE_WORKERS: process.env.WEB_DISABLE_WORKERS === 'true',
};

export default ENV;
