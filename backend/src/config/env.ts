interface IENV {
  ACCESS_TOKEN_EXPIRY: string;
  ACCESS_TOKEN_SECRET: string;
  ADMIN_EMAIL: string;
  ADMIN_NAME: string;
  ADMIN_PASSWORD: string;
  ADMIN_PHONE: string;
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
  PAYSTACK_CALLBACK_URL?: string;
  PAYSTACK_SECRET_KEY: string;
  PORT: number;
  REDIS_URL: string;
  REFRESH_TOKEN_EXPIRY: string;
  REFRESH_TOKEN_SECRET: string;
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
  ADMIN_EMAIL: assertEnv(process.env.ADMIN_EMAIL, 'ADMIN_EMAIL'),
  ADMIN_NAME: assertEnv(process.env.ADMIN_NAME, 'ADMIN_NAME'),
  ADMIN_PASSWORD: assertEnv(process.env.ADMIN_PASSWORD, 'ADMIN_PASSWORD'),
  ADMIN_PHONE: assertEnv(process.env.ADMIN_PHONE, 'ADMIN_PHONE'),
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
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PASSWORD: process.env.SMTP_PASSWORD,
  SMTP_PORT: Number(process.env.SMTP_PORT) || 587,
  SMTP_SECURE: process.env.SMTP_SECURE === 'true',
  SMTP_USER: process.env.SMTP_USER,
  WEB_DISABLE_WORKERS: process.env.WEB_DISABLE_WORKERS === 'true',
};

export default ENV;
