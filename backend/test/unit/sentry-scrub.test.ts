// test/unit/sentry-scrub.test.ts
//
// Outgoing Sentry events pass through the same key-based masking the error
// handler applies to logs, so a credential that reaches an event's extra
// data, contexts, request or message is masked before it leaves the box.
// Keys survive so the shape of the data still reads.
import type { ErrorEvent } from '@sentry/node';

import { describe, expect, it } from 'vitest';

import { scrubEvent } from '#lib/sentry.js';

const event = (overrides: Partial<ErrorEvent>): ErrorEvent => ({
  type: undefined,
  ...overrides,
});

describe('scrubEvent', () => {
  it('masks sensitive keys in extra and contexts, keeping the keys', () => {
    const scrubbed = scrubEvent(
      event({
        contexts: {
          request: { code: 'X', nested: { apiKey: 'k', ok: 1 } },
        },
        extra: { password: 'hunter2', safe: 'yes' },
      }),
    );

    expect(scrubbed.extra).toEqual({ password: '[REDACTED]', safe: 'yes' });
    expect(scrubbed.contexts).toEqual({
      request: { code: 'X', nested: { apiKey: '[REDACTED]', ok: 1 } },
    });
  });

  it('masks request headers, cookies, body and query string', () => {
    const scrubbed = scrubEvent(
      event({
        request: {
          cookies: { accessToken: 'jwt' },
          data: { email: 'jane@example.com', password: 'hunter2' },
          headers: {
            accept: 'application/json',
            authorization: 'Bearer x',
            cookie: 'accessToken=y',
          },
          method: 'POST',
          query_string: 'token=abc&page=2',
          url: 'https://api.example.com/auth/login',
        },
      }),
    );

    expect(scrubbed.request).toEqual({
      cookies: { accessToken: '[REDACTED]' },
      data: { email: 'jane@example.com', password: '[REDACTED]' },
      headers: {
        accept: 'application/json',
        authorization: '[REDACTED]',
        cookie: '[REDACTED]',
      },
      method: 'POST',
      query_string: 'token=[REDACTED]&page=2',
      url: 'https://api.example.com/auth/login',
    });
  });

  it('masks key=value and key: value pairs inside exception messages', () => {
    const scrubbed = scrubEvent(
      event({
        exception: {
          values: [
            {
              type: 'Error',
              value: 'login failed for password=hunter2 with token: "abc"',
            },
          ],
        },
        message: "refresh secret='s3' rejected",
      }),
    );

    expect(scrubbed.exception?.values?.[0].value).toBe(
      'login failed for password=[REDACTED] with token: [REDACTED]',
    );
    expect(scrubbed.message).toBe('refresh secret=[REDACTED] rejected');
  });

  it('leaves an event with nothing sensitive untouched', () => {
    const input = event({ extra: { bookingId: 7 }, message: 'plain' });

    expect(scrubEvent(input)).toEqual(input);
  });
});
