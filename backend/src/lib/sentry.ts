// src/lib/sentry.ts
//
// Error tracking (ported from khadys). Optional and fail-safe: when
// SENTRY_DSN is unset the whole module is a no-op — nothing is initialized
// and nothing leaves the box. Only UNEXPECTED errors (5xx / HIGH-CRITICAL
// severity) are reported by the central error handler; expected 4xx
// (NotFound, Validation, …) stay log-only, so the tracker isn't paged for
// routine client mistakes. Reports carry the requestId + sanitized context so
// a tracked issue maps back to the exact request and its server logs.
import * as Sentry from '@sentry/node';

import ENV from '#config/env.js';
import logger from '#utils/logger.js';

let enabled = false;

/**
 * Initializes Sentry once at process start (server and worker entrypoints).
 * Safe to call when SENTRY_DSN is unset — it simply stays disabled.
 */
export const initSentry = (): void => {
  if (enabled || !ENV.SENTRY_DSN) return;

  Sentry.init({
    // We report explicitly from the central error handler, so disable the
    // default unhandled-error integrations that would double-report.
    defaultIntegrations: false,
    dsn: ENV.SENTRY_DSN,
    environment: ENV.SENTRY_ENVIRONMENT,
    tracesSampleRate: ENV.SENTRY_TRACES_SAMPLE_RATE,
  });

  enabled = true;
  logger.info(
    { environment: ENV.SENTRY_ENVIRONMENT },
    'Sentry error tracking enabled',
  );
};

export const isSentryEnabled = (): boolean => enabled;

export interface ReportContext {
  /** Already-sanitized context (no secrets/PII) — see error-handler redaction. */
  context?: Record<string, unknown>;
  method?: string;
  requestId?: string;
  route?: string;
}

/**
 * Reports an unexpected error to Sentry with correlation tags. No-op when
 * Sentry is disabled. Never throws — a tracker outage must not break the
 * request path.
 */
export const reportError = (error: unknown, meta: ReportContext = {}): void => {
  if (!enabled) return;

  try {
    Sentry.withScope((scope) => {
      if (meta.requestId) scope.setTag('requestId', meta.requestId);
      if (meta.route) scope.setTag('route', meta.route);
      if (meta.method) scope.setTag('method', meta.method);
      if (meta.context) scope.setContext('request', meta.context);
      Sentry.captureException(error);
    });
  } catch (err) {
    logger.warn(err, 'Failed to report error to Sentry');
  }
};

/** Flushes buffered events on shutdown so in-flight reports aren't lost. */
export const flushSentry = async (timeoutMs = 2000): Promise<void> => {
  if (!enabled) return;
  try {
    await Sentry.flush(timeoutMs);
  } catch {
    /* best-effort on shutdown */
  }
};
