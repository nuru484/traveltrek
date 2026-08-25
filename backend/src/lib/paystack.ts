// src/lib/paystack.ts
//
// Thin Paystack HTTP client. Services depend on this surface (via AppDeps)
// instead of calling axios inline, so tests can fake payments without the
// network and the auth header / base URL / timeout live in one place. Every
// provider failure is mapped to a typed CustomError here so the layers above
// never see an axios shape: a 502 with a PAYSTACK_* code, or a 409
// PAYSTACK_ALREADY_REFUNDED when Paystack reports a charge already reversed.
import axios from 'axios';
import crypto from 'crypto';

import ENV from '#config/env.js';
import { CustomError } from '#middlewares/error-handler.js';
import logger from '#utils/logger.js';

const PAYSTACK_API_BASE_URL = ENV.PAYSTACK_API_BASE_URL;

/** Outbound calls are bounded so a stalled provider cannot hold a request or
 * a sweep tick open indefinitely. */
const PAYSTACK_TIMEOUT_MS = 15_000;

/** The refund list is paged newest first; the windowed sweep stops at the
 * first page older than its cutoff, and this caps a runaway walk. */
const REFUND_LIST_MAX_PAGES = 10;
const REFUND_LIST_PAGE_SIZE = 100;

const authHeaders = () => ({
  Authorization: `Bearer ${ENV.PAYSTACK_SECRET_KEY}`,
  'Content-Type': 'application/json',
});

const requestOptions = () => ({
  headers: authHeaders(),
  timeout: PAYSTACK_TIMEOUT_MS,
});

export interface PaystackInitializeResult {
  access_code: string;
  authorization_url: string;
  reference: string;
}

/** One refund Paystack holds against a charge. `amount` is this refund's
 * value and `transaction_amount` the original charge's, which is how a
 * partial refund is told from a full one. */
export interface PaystackRefundResult {
  amount: null | number;
  id: number;
  status: string;
  transaction_amount?: null | number;
  /** Our own transaction reference, present on the list endpoint. */
  transaction_reference?: null | string;
}

export interface PaystackVerifyResult {
  amount: number;
  currency: string;
  /** Paystack's own description of the outcome ("Approved", "Declined"). */
  gateway_response?: null | string;
  /** Echo of the metadata sent at initialization (e.g. `{ bookingId }`). */
  metadata?: null | Record<string, unknown>;
  paid_at: null | string;
  reference: string;
  status: string;
}

interface PaystackEnvelope<T> {
  data: T;
  message: string;
  meta?: { page?: number; pageCount?: number };
  status: boolean;
}

interface RefundListRow {
  amount: null | number;
  createdAt?: null | string;
  id: number;
  status: string;
  transaction_amount: null | number;
  transaction_reference: null | string;
}

/** The `message` Paystack put in an error response body, if any. Read
 * structurally rather than through axios.isAxiosError so the helper also
 * works when axios itself is replaced by a test double. */
const providerMessage = (error: unknown): string => {
  const body = (error as { response?: { data?: { message?: unknown } } })
    .response?.data;
  return typeof body?.message === 'string' ? body.message : '';
};

const providerError = (
  error: unknown,
  code: string,
  message: string,
): CustomError => {
  logger.error({ err: error, provider: providerMessage(error) }, message);
  return new CustomError(502, message, { code, layer: 'paystack' });
};

export const initializePaystackTransaction = async (params: {
  amount: number;
  callbackUrl?: string;
  channels?: string[];
  currency?: string;
  email: string;
  metadata?: Record<string, unknown>;
  reference?: string;
}): Promise<PaystackInitializeResult> => {
  try {
    const response = await axios.post<
      PaystackEnvelope<PaystackInitializeResult>
    >(
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
      requestOptions(),
    );
    return response.data.data;
  } catch (error) {
    throw providerError(
      error,
      'PAYSTACK_INIT_FAILED',
      'Could not start the payment. Please try again.',
    );
  }
};

export const verifyPaystackTransaction = async (
  reference: string,
): Promise<PaystackVerifyResult> => {
  try {
    const response = await axios.get<PaystackEnvelope<PaystackVerifyResult>>(
      `${PAYSTACK_API_BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`,
      requestOptions(),
    );
    return response.data.data;
  } catch (error) {
    throw providerError(
      error,
      'PAYSTACK_VERIFY_FAILED',
      'Could not verify the payment. Please try again.',
    );
  }
};

/**
 * Refunds a charge (the full amount, or a partial `amount` in minor units).
 * Paystack rejects a second refund of an already-reversed charge with a 4xx
 * naming the reversal; that is surfaced as a distinct 409 code so callers can
 * treat "already refunded at the provider" as settled instead of un-claiming
 * the local reversal and retrying forever.
 */
export const refundPaystackTransaction = async (params: {
  amount?: number;
  reference: string;
}): Promise<PaystackRefundResult> => {
  try {
    const response = await axios.post<PaystackEnvelope<PaystackRefundResult>>(
      `${PAYSTACK_API_BASE_URL}/refund`,
      { amount: params.amount, transaction: params.reference },
      requestOptions(),
    );
    return response.data.data;
  } catch (error) {
    if (/already|fully revers|fully refund/i.test(providerMessage(error))) {
      throw new CustomError(
        409,
        'This charge was already refunded at Paystack.',
        { code: 'PAYSTACK_ALREADY_REFUNDED', layer: 'paystack' },
      );
    }
    throw providerError(
      error,
      'PAYSTACK_REFUND_FAILED',
      'Could not process the refund. Please try again.',
    );
  }
};

const toRefundResult = (row: RefundListRow): PaystackRefundResult => ({
  amount: row.amount,
  id: row.id,
  status: row.status,
  transaction_amount: row.transaction_amount,
  transaction_reference: row.transaction_reference,
});

/** The refunds Paystack holds for one transaction reference. Answers "did the
 * refund the ledger claimed actually reach Paystack?". */
export const listPaystackRefunds = async (
  reference: string,
): Promise<PaystackRefundResult[]> => {
  try {
    const response = await axios.get<PaystackEnvelope<RefundListRow[]>>(
      `${PAYSTACK_API_BASE_URL}/refund`,
      { ...requestOptions(), params: { transaction: reference } },
    );
    return response.data.data.map(toRefundResult);
  } catch (error) {
    throw providerError(
      error,
      'PAYSTACK_REFUND_LIST_FAILED',
      'Could not fetch refunds from Paystack. Please try again.',
    );
  }
};

/**
 * Every refund Paystack recorded since `from`, newest first. Answers the
 * opposite question to listPaystackRefunds: "did someone refund a charge on
 * the dashboard that the ledger still calls COMPLETED?". One windowed call
 * covers every refund at once, so reconciliation cost stays flat as the
 * ledger grows.
 */
export const listPaystackRefundsSince = async (
  from: Date,
): Promise<PaystackRefundResult[]> => {
  const collected: PaystackRefundResult[] = [];
  try {
    for (let page = 1; page <= REFUND_LIST_MAX_PAGES; page += 1) {
      const response = await axios.get<PaystackEnvelope<RefundListRow[]>>(
        `${PAYSTACK_API_BASE_URL}/refund`,
        {
          ...requestOptions(),
          params: {
            from: from.toISOString(),
            page,
            perPage: REFUND_LIST_PAGE_SIZE,
          },
        },
      );
      const rows = response.data.data;
      collected.push(...rows.map(toRefundResult));
      const pageCount = response.data.meta?.pageCount ?? 1;
      if (rows.length < REFUND_LIST_PAGE_SIZE || page >= pageCount) break;
    }
    return collected;
  } catch (error) {
    throw providerError(
      error,
      'PAYSTACK_REFUND_LIST_FAILED',
      'Could not fetch refunds from Paystack. Please try again.',
    );
  }
};

/**
 * Verifies a Paystack webhook signature over the raw request body bytes.
 * (HMAC over a re-serialized JSON.stringify(req.body) is fragile: key order
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
