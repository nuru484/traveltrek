// src/lib/sentry.ts
//
// Error tracking. Optional and fail-safe: when
// SENTRY_DSN is unset the whole module is a no-op — nothing is initialized
// and nothing leaves the box. Only UNEXPECTED errors (5xx / HIGH-CRITICAL
// severity) are reported by the central error handler; expected 4xx
// (NotFound, Validation, …) stay log-only, so the tracker isn't paged for
// routine client mistakes. Reports carry the requestId + sanitized context so
// a tracked issue maps back to the exact request and its server logs.
import * as Sentry from '@sentry/node';

import ENV from '#config/env.js';
import {
  isSensitiveKey,
  REDACTED,
  sanitizeErrorData,
  SENSITIVE_KEY_FRAGMENTS,
} from '#lib/sanitize.js';
import logger from '#utils/logger.js';

let enabled = false;

// `password=hunter2`, `token: "abc"`, `apiKey='x'` inside free text: the
// value after the separator is masked, the key stays so the message still
// says what was there.
const SENSITIVE_ASSIGNMENT = new RegExp(
  String.raw`(\b[\w-]*(?:${SENSITIVE_KEY_FRAGMENTS.join('|')})[\w-]*\s*[=:]\s*)("[^"]*"|'[^']*'|[^\s,;&]+)`,
  'gi',
);

const scrubText = (text: string): string =>
  text.replace(SENSITIVE_ASSIGNMENT, `$1${REDACTED}`);

const scrubRecord = <T extends Record<string, unknown>>(record: T): T =>
  sanitizeErrorData(record) as T;

const scrubUnknown = <T>(value: T): T => {
  if (typeof value === 'string') return scrubText(value) as T;
  if (value !== null && typeof value === 'object') {
    return scrubRecord(value as Record<string, unknown>) as T;
  }
  return value;
};

// Cookies are session material through and through; every value goes.
const maskValues = (record: Record<string, string>): Record<string, string> =>
  Object.fromEntries(Object.keys(record).map((key) => [key, REDACTED]));

/**
 * Masks sensitive values on an outgoing event using the same key fragments
 * the error handler redacts from logs: `extra`, every context, the request
 * (headers, cookies, query string, body) and the messages themselves. Keys
 * survive, values do not. Pure, so the same input always scrubs the same way.
 */
export const scrubEvent = <E extends Sentry.ErrorEvent>(event: E): E => {
  const scrubbed: E = { ...event };

  if (scrubbed.extra) scrubbed.extra = scrubRecord(scrubbed.extra);

  if (scrubbed.contexts) {
    scrubbed.contexts = Object.fromEntries(
      Object.entries(scrubbed.contexts).map(([name, context]) => [
        name,
        context ? scrubRecord(context) : context,
      ]),
    );
  }

  if (scrubbed.request) {
    const { cookies, data, headers, query_string, ...rest } = scrubbed.request;
    scrubbed.request = {
      ...rest,
      ...(cookies !== undefined && { cookies: maskValues(cookies) }),
      ...(data !== undefined && { data: scrubUnknown(data) }),
      ...(headers !== undefined && {
        headers: Object.fromEntries(
          Object.entries(headers).map(([key, value]) => [
            key,
            isSensitiveKey(key) || key.toLowerCase() === 'cookie'
              ? REDACTED
              : value,
          ]),
        ),
      }),
      ...(query_string !== undefined && {
        query_string:
          typeof query_string === 'string'
            ? scrubText(query_string)
            : query_string,
      }),
    };
  }

  if (scrubbed.message) scrubbed.message = scrubText(scrubbed.message);

  if (scrubbed.exception?.values) {
    scrubbed.exception = {
      ...scrubbed.exception,
      values: scrubbed.exception.values.map((value) =>
        value.value ? { ...value, value: scrubText(value.value) } : value,
      ),
    };
  }

  return scrubbed;
};

/**
 * Initializes Sentry once at process start (server and worker entrypoints).
 * Safe to call when SENTRY_DSN is unset — it simply stays disabled.
 */
export const initSentry = (): void => {
  if (enabled || !ENV.SENTRY_DSN) return;

  Sentry.init({
    beforeSend: scrubEvent,
    // We report explicitly from the central error handler, so disable the
    // default unhandled-error integrations that would double-report.
    defaultIntegrations: false,
    dsn: ENV.SENTRY_DSN,
    environment: ENV.SENTRY_ENVIRONMENT,
    release: ENV.SENTRY_RELEASE,
    // No IP addresses or cookies on events; the principal is attached
    // explicitly as an opaque id in reportError.
    sendDefaultPii: false,
    tracesSampleRate: ENV.SENTRY_TRACES_SAMPLE_RATE,
  });

  enabled = true;
  logger.info(
    { environment: ENV.SENTRY_ENVIRONMENT, release: ENV.SENTRY_RELEASE },
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
  /** Opaque principal id (`kind:id`); never an email, phone or name. */
  userId?: string;
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
      // Explicit null clears any user a previous report left on the scope,
      // so an unauthenticated failure is never attributed to someone.
      scope.setUser(meta.userId ? { id: meta.userId } : null);
      Sentry.captureException(error);
    });
  } catch (err) {
    logger.warn(err, 'Failed to report error to Sentry');
  }
};

/**
 * Reports a process-level failure (unhandled rejection, uncaught exception)
 * and waits for the client to flush, so the event reaches the tracker before
 * the process shuts down.
 */
export const reportFatal = async (
  error: unknown,
  source: 'uncaughtException' | 'unhandledRejection',
): Promise<void> => {
  reportError(error, { context: { source } });
  await flushSentry();
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
