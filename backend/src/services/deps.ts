// src/services/deps.ts
//
// Central dependency wiring for the service layer. Every service is a factory
// `makeXService(deps)` that receives its collaborators here instead of
// importing them directly, so unit tests can pass fakes for cloudinary /
// paystack / mail / sms / google / the clock while keeping the real (test-DB)
// Prisma client.
//
// `defaultDeps` is the production wiring; controllers import the default-wired
// singletons, so they need no knowledge of this indirection.
import { cloudinaryService } from '#config/claudinary.js';
import ENV from '#config/env.js';
import prismaClient from '#config/prismaClient.js';
import { Clock, systemClock } from '#lib/clock.js';
import { verifyGoogleIdToken } from '#lib/google-auth.js';
import { sendMail } from '#lib/mail.js';
import {
  initializePaystackTransaction,
  refundPaystackTransaction,
  verifyPaystackTransaction,
} from '#lib/paystack.js';
import { sendSms } from '#lib/sms.js';
import {
  makeInlineNotify,
  makeQueuedNotify,
  type NotifyClient,
} from '#notifications/notify.js';
import loggerInstance from '#utils/logger.js';

/** Config values services read; injected so tests can vary them. */
export interface AppConfig {
  ACCESS_TOKEN_EXPIRY: string;
  ACCESS_TOKEN_SECRET: string;
  /** Server-side demo login: which real account each demo role resolves to,
   * and whether the endpoint is enabled at all. An unset email for an enabled
   * role makes that role's demo login 404 (the account isn't seeded). */
  DEMO_ADMIN_EMAIL?: string;
  DEMO_AGENT_EMAIL?: string;
  DEMO_CUSTOMER_EMAIL?: string;
  DEMO_LOGIN_ENABLED: boolean;
  FRONTEND_URL: string;
  /** Unset means Google sign-in is not configured (the endpoint 503s). */
  GOOGLE_CLIENT_ID?: string;
  PAYSTACK_CALLBACK_URL?: string;
  REFRESH_TOKEN_EXPIRY: string;
  REFRESH_TOKEN_SECRET: string;
}

export interface AppDeps {
  clock: Clock;
  cloudinary: CloudinaryClient;
  config: AppConfig;
  google: GoogleAuthClient;
  logger: Logger;
  mail: MailClient;
  /** Durable outbound notifications (queued with retries in production). */
  notify: NotifyClient;
  paystack: PaystackClient;
  prisma: DbClient;
  sms: SmsClient;
}

/** Cloudinary image I/O surface; injected so tests upload/delete without network. */
export interface CloudinaryClient {
  deleteImage: typeof cloudinaryService.deleteImage;
  uploadImage: typeof cloudinaryService.uploadImage;
}

export type DbClient = typeof prismaClient;

/** Google ID-token verification surface; injected so tests fake identities. */
export interface GoogleAuthClient {
  verifyIdToken: typeof verifyGoogleIdToken;
}

export type Logger = typeof loggerInstance;

/** Outbound email surface; injected so tests capture messages instead. */
export interface MailClient {
  send: typeof sendMail;
}

/** Paystack I/O surface; injected so tests run without hitting the API. */
export interface PaystackClient {
  initialize: typeof initializePaystackTransaction;
  refund: typeof refundPaystackTransaction;
  verify: typeof verifyPaystackTransaction;
}

/** Outbound SMS surface; injected so tests capture messages instead. */
export interface SmsClient {
  send: typeof sendSms;
}

export const defaultDeps: AppDeps = {
  clock: systemClock,
  cloudinary: {
    deleteImage: cloudinaryService.deleteImage.bind(cloudinaryService),
    uploadImage: cloudinaryService.uploadImage.bind(cloudinaryService),
  },
  config: {
    ACCESS_TOKEN_EXPIRY: ENV.ACCESS_TOKEN_EXPIRY,
    ACCESS_TOKEN_SECRET: ENV.ACCESS_TOKEN_SECRET,
    DEMO_ADMIN_EMAIL: ENV.DEMO_ADMIN_EMAIL,
    DEMO_AGENT_EMAIL: ENV.DEMO_AGENT_EMAIL,
    DEMO_CUSTOMER_EMAIL: ENV.DEMO_CUSTOMER_EMAIL,
    DEMO_LOGIN_ENABLED: ENV.DEMO_LOGIN_ENABLED,
    FRONTEND_URL: ENV.FRONTEND_URL,
    GOOGLE_CLIENT_ID: ENV.GOOGLE_CLIENT_ID,
    PAYSTACK_CALLBACK_URL: ENV.PAYSTACK_CALLBACK_URL,
    REFRESH_TOKEN_EXPIRY: ENV.REFRESH_TOKEN_EXPIRY,
    REFRESH_TOKEN_SECRET: ENV.REFRESH_TOKEN_SECRET,
  },
  google: { verifyIdToken: verifyGoogleIdToken },
  logger: loggerInstance,
  mail: { send: sendMail },
  notify: ENV.NOTIFICATIONS_INLINE
    ? makeInlineNotify({
        logger: loggerInstance,
        mail: { send: sendMail },
        sms: { send: sendSms },
      })
    : makeQueuedNotify(loggerInstance),
  paystack: {
    initialize: initializePaystackTransaction,
    refund: refundPaystackTransaction,
    verify: verifyPaystackTransaction,
  },
  prisma: prismaClient,
  sms: { send: sendSms },
};
