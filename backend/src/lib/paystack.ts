// src/lib/paystack.ts
//
// Thin Paystack HTTP client. Services depend on this surface (via AppDeps)
// instead of calling axios inline, so tests can fake payments without the
// network and the auth header / base URL live in one place.
import axios from 'axios';
import crypto from 'crypto';

import ENV from '../config/env';

const PAYSTACK_API_BASE_URL =
  process.env.PAYSTACK_API_BASE_URL ?? 'https://api.paystack.co';

const authHeaders = () => ({
  Authorization: `Bearer ${ENV.PAYSTACK_SECRET_KEY}`,
  'Content-Type': 'application/json',
});

export interface PaystackInitializeResult {
  access_code: string;
  authorization_url: string;
  reference: string;
}

export interface PaystackVerifyResult {
  amount: number;
  currency: string;
  /** Echo of the metadata sent at initialization (e.g. `{ bookingId }`). */
  metadata?: null | Record<string, unknown>;
  paid_at: null | string;
  reference: string;
  status: string;
}

interface PaystackEnvelope<T> {
  data: T;
  message: string;
  status: boolean;
}

export const initializePaystackTransaction = async (params: {
  amount: number;
  callbackUrl?: string;
  channels?: string[];
  currency?: string;
  email: string;
  metadata?: Record<string, unknown>;
  reference?: string;
}): Promise<PaystackInitializeResult> => {
  const response = await axios.post<PaystackEnvelope<PaystackInitializeResult>>(
    `${PAYSTACK_API_BASE_URL}/transaction/initialize`,
    {
      amount: params.amount,
      callback_url: params.callbackUrl ?? ENV.PAYSTACK_CALLBACK_URL,
      channels: params.channels,
      currency: params.currency,
      email: params.email,
      metadata: params.metadata,
      reference: params.reference,
    },
    { headers: authHeaders() },
  );
  return response.data.data;
};

export const verifyPaystackTransaction = async (
  reference: string,
): Promise<PaystackVerifyResult> => {
  const response = await axios.get<PaystackEnvelope<PaystackVerifyResult>>(
    `${PAYSTACK_API_BASE_URL}/transaction/verify/${reference}`,
    { headers: authHeaders() },
  );
  return response.data.data;
};

export const refundPaystackTransaction = async (params: {
  amount?: number;
  reference: string;
}): Promise<{ id: number; status: string }> => {
  const response = await axios.post<
    PaystackEnvelope<{ id: number; status: string }>
  >(
    `${PAYSTACK_API_BASE_URL}/refund`,
    { amount: params.amount, transaction: params.reference },
    { headers: authHeaders() },
  );
  return response.data.data;
};

/**
 * Verifies a Paystack webhook signature over the raw request body bytes.
 * (HMAC over a re-serialized JSON.stringify(req.body) is fragile — key order
 * and whitespace must match the wire bytes exactly.)
 */
export const verifyPaystackSignature = (
  rawBody: Buffer | string,
  signature: string | undefined,
): boolean => {
  if (!signature) return false;
  const expected = crypto
    .createHmac('sha512', ENV.PAYSTACK_SECRET_KEY)
    .update(rawBody)
    .digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
