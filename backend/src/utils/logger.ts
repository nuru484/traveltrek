import { pino } from 'pino';
import pretty from 'pino-pretty';

import ENV from '#config/env.js';
import { getRequestId } from '#lib/request-context.js';

const isProduction = ENV.NODE_ENV === 'production';

// Credentials and contact details are masked at the sink, whatever the call
// site passes: request bodies (login, password change, OTP/reset codes, phone
// changes), auth headers on serialized requests, and cookies on responses.
export const redactOptions = {
  censor: '[REDACTED]',
  paths: [
    '*.password',
    '*.newPassword',
    '*.currentPassword',
    '*.confirmPassword',
    '*.token',
    '*.refreshToken',
    '*.accessToken',
    '*.idToken',
    '*.secret',
    '*.otp',
    '*.code',
    '*.phone',
    '*.newPhone',
    '*.authorization',
    'req.headers.authorization',
    'req.headers.cookie',
    'res.headers["set-cookie"]',
  ],
};

// Every line written inside a request context (or a job replaying one)
// carries that requestId, so service and job logs correlate with the access
// log without the id being threaded through every call.
export const requestContextMixin = (): Record<string, unknown> => {
  const requestId = getRequestId();
  return requestId ? { requestId } : {};
};

// JSON logs in production (for log aggregators); pretty-printed in dev only.
// Dev prints through a plain stream rather than pino's worker-thread
// transport: under `tsx --watch` the worker's message channel breaks on the
// first write, and the ThreadStream error event takes the process down before
// anything reaches the terminal.
const logger = isProduction
  ? pino({
      level: ENV.LOG_LEVEL ?? 'info',
      mixin: requestContextMixin,
      redact: redactOptions,
    })
  : pino(
      {
        level: ENV.LOG_LEVEL ?? 'debug',
        mixin: requestContextMixin,
        redact: redactOptions,
      },
      pretty({
        colorize: true,
        ignore: '',
        singleLine: false,
        translateTime: true,
      }),
    );

export default logger;
