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
  NODE_ENV: string;
  PAYSTACK_CALLBACK_URL?: string;
  PAYSTACK_SECRET_KEY: string;
  PORT: number;
  REDIS_URL: string;
  REFRESH_TOKEN_EXPIRY: string;
  REFRESH_TOKEN_SECRET: string;
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
};

export default ENV;
