export function assertEnv<T>(value: T | undefined, name: string): T {
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

interface IENV {
  PORT: number;
  NODE_ENV: string;
  DATABASE_URL: string;
  CORS_ACCESS?: string;
  CLOUDINARY_CLOUD_NAME: string;
  CLOUDINARY_API_KEY: string;
  CLOUDINARY_API_SECRET: string;
  ACCESS_TOKEN_SECRET?: string;
  ACCESS_TOKEN_EXPIRY?: string;
  REFRESH_TOKEN_SECRET?: string;
  REFRESH_TOKEN_EXPIRY?: string;
  COOKIE_DOMAIN?: string;
  PAYSTACK_SECRET_KEY: string;
  PAYSTACK_CALLBACK_URL?: string;
  ADMIN_EMAIL: string;
  ADMIN_PASSWORD: string;
  ADMIN_NAME: string;
  ADMIN_PHONE: string;
  REDIS_URL: string;
}

const ENV: IENV = {
  PORT: Number(process.env.PORT) || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  CORS_ACCESS: process.env.CORS_ACCESS,
  DATABASE_URL: assertEnv(process.env.DATABASE_URL, 'DATABASE_URL'),
  CLOUDINARY_CLOUD_NAME: assertEnv(
    process.env.CLOUDINARY_CLOUD_NAME,
    'CLOUDINARY_CLOUD_NAME',
  ),
  CLOUDINARY_API_KEY: assertEnv(
    process.env.CLOUDINARY_API_KEY,
    'CLOUDINARY_API_KEY',
  ),
  CLOUDINARY_API_SECRET: assertEnv(
    process.env.CLOUDINARY_API_SECRET,
    'CLOUDINARY_API_SECRET',
  ),
  COOKIE_DOMAIN: process.env.COOKIE_DOMAIN || undefined,
  ACCESS_TOKEN_SECRET: process.env.ACCESS_TOKEN_SECRET,
  ACCESS_TOKEN_EXPIRY: process.env.ACCESS_TOKEN_EXPIRY || '30m',
  REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET,
  REFRESH_TOKEN_EXPIRY: process.env.REFRESH_TOKEN_EXPIRY || '7d',
  PAYSTACK_SECRET_KEY: assertEnv(
    process.env.PAYSTACK_SECRET_KEY,
    'PAYSTACK_SECRET_KEY',
  ),
  PAYSTACK_CALLBACK_URL: process.env.PAYSTACK_CALLBACK_URL,
  ADMIN_EMAIL: assertEnv(process.env.ADMIN_EMAIL, 'ADMIN_EMAIL'),
  ADMIN_PASSWORD: assertEnv(process.env.ADMIN_PASSWORD, 'ADMIN_PASSWORD'),
  ADMIN_NAME: assertEnv(process.env.ADMIN_NAME, 'ADMIN_NAME'),
  ADMIN_PHONE: assertEnv(process.env.ADMIN_PHONE, 'ADMIN_PHONE'),
  REDIS_URL: assertEnv(process.env.REDIS_URL, 'REDIS_URL'),
};

export default ENV;
