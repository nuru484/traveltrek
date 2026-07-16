// src/lib/sms.ts
//
// Default SMS transport for the `sms` dep in AppDeps, via the Frog (Wigal)
// API — same provider/contract as khadys/dms. Auth is two custom headers
// (API-KEY + USERNAME); the sender id goes in the body; success is HTTP 200
// with `status: "ACCEPTD"`. When the FROG_* env vars are absent the
// "transport" just logs the message (dev/CI-friendly). Never throws — callers
// fire-and-forget, and a delivery failure must never fail the request.
import ENV from '#config/env.js';
import logger from '#utils/logger.js';

const FROG_BASE_URL = 'https://frogapi.wigal.com.gh/api/v3';

export interface SendSmsParams {
  message: string;
  to: string;
}

interface FrogResponse {
  message?: string;
  status?: string;
}

// Frog rejects non-GSM-7 characters in text mode — fold the common
// typographic ones to their ASCII equivalents.
const toGsm7Safe = (message: string): string =>
  message
    .replace(/[–—]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, '...')
    .replace(/\u00A0/g, ' ');

const frogConfigured = (): boolean =>
  Boolean(ENV.FROG_API_KEY && ENV.FROG_USERNAME && ENV.FROG_SENDER_ID);

/** Sends a single SMS via Frog (or logs it when Frog is not configured). */
export const sendSms = async (params: SendSmsParams): Promise<void> => {
  if (!frogConfigured()) {
    logger.info(
      { message: params.message, to: params.to },
      'Frog SMS not configured — SMS logged instead of sent',
    );
    return;
  }

  const payload = {
    destinations: [
      { destination: params.to, msgid: `MSG_${String(Date.now())}` },
    ],
    message: toGsm7Safe(params.message),
    senderid: ENV.FROG_SENDER_ID,
    smstype: 'text',
  };

  try {
    const response = await fetch(`${FROG_BASE_URL}/sms/send`, {
      body: JSON.stringify(payload),
      headers: {
        'API-KEY': ENV.FROG_API_KEY ?? '',
        'Content-Type': 'application/json',
        USERNAME: ENV.FROG_USERNAME ?? '',
      },
      method: 'POST',
      // Cap the wait so a stalled Frog socket can't pile up requests.
      signal: AbortSignal.timeout(5000),
    });
    const data = (await response.json().catch(() => null)) as FrogResponse | null;
    if (!response.ok || data?.status !== 'ACCEPTD') {
      logger.error(
        { status: data?.status, to: params.to },
        'SMS was not accepted by Frog',
      );
    }
  } catch (error) {
    logger.error({ err: error, to: params.to }, 'SMS send failed (network)');
  }
};
