// src/services/deps.ts
//
// Central dependency wiring for the service layer. Every service is a factory
// `makeXService(deps)` that receives its collaborators here instead of
// importing them directly, so unit tests can pass fakes for cloudinary /
// paystack / the clock while keeping the real (test-DB) Prisma client.
//
// `defaultDeps` is the production wiring; controllers import the default-wired
// singletons, so they need no knowledge of this indirection.
import { cloudinaryService } from '../config/claudinary';
import ENV from '../config/env';
import prismaClient from '../config/prismaClient';
import { Clock, systemClock } from '../lib/clock';
import {
  initializePaystackTransaction,
  refundPaystackTransaction,
  verifyPaystackTransaction,
} from '../lib/paystack';
import loggerInstance from '../utils/logger';

/** Config values services read; injected so tests can vary them. */
export interface AppConfig {
  PAYSTACK_CALLBACK_URL?: string;
  REFRESH_TOKEN_EXPIRY: string;
}

export interface AppDeps {
  clock: Clock;
  cloudinary: CloudinaryClient;
  config: AppConfig;
  logger: Logger;
  paystack: PaystackClient;
  prisma: DbClient;
}

/** Cloudinary image I/O surface; injected so tests upload/delete without network. */
export interface CloudinaryClient {
  deleteImage: typeof cloudinaryService.deleteImage;
  uploadImage: typeof cloudinaryService.uploadImage;
}

export type DbClient = typeof prismaClient;

export type Logger = typeof loggerInstance;

/** Paystack I/O surface; injected so tests run without hitting the API. */
export interface PaystackClient {
  initialize: typeof initializePaystackTransaction;
  refund: typeof refundPaystackTransaction;
  verify: typeof verifyPaystackTransaction;
}

export const defaultDeps: AppDeps = {
  clock: systemClock,
  cloudinary: {
    deleteImage: cloudinaryService.deleteImage.bind(cloudinaryService),
    uploadImage: cloudinaryService.uploadImage.bind(cloudinaryService),
  },
  config: {
    PAYSTACK_CALLBACK_URL: ENV.PAYSTACK_CALLBACK_URL,
    REFRESH_TOKEN_EXPIRY: ENV.REFRESH_TOKEN_EXPIRY ?? '7d',
  },
  logger: loggerInstance,
  paystack: {
    initialize: initializePaystackTransaction,
    refund: refundPaystackTransaction,
    verify: verifyPaystackTransaction,
  },
  prisma: prismaClient,
};
