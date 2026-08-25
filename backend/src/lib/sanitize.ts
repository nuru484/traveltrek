// src/lib/sanitize.ts
//
// Key-based masking shared by the error handler (log lines, error responses)
// and the Sentry wrapper (outgoing events). Any key containing one of these
// fragments has its value replaced, at any depth; keys are kept so the shape
// of the data stays readable.
export const SENSITIVE_KEY_FRAGMENTS = [
  'password',
  'token',
  'secret',
  'auth',
  'key',
  'credit',
  'ssn',
] as const;

export const REDACTED = '[REDACTED]';

export const isSensitiveKey = (key: string): boolean => {
  const lower = key.toLowerCase();
  return SENSITIVE_KEY_FRAGMENTS.some((fragment) => lower.includes(fragment));
};

/**
 * Sanitize error data for safe logging and response
 */
export const sanitizeErrorData = (data: unknown): unknown => {
  if (!data) return data;

  if (typeof data === 'object') {
    const sanitized: Record<string, unknown> = {};

    Object.entries(data as Record<string, unknown>).forEach(([key, value]) => {
      if (isSensitiveKey(key)) {
        sanitized[key] = REDACTED;
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = sanitizeErrorData(value);
      } else {
        sanitized[key] = value;
      }
    });

    return sanitized;
  }

  return data;
};
