// test/unit/sentry-disabled.test.ts
//
// Without SENTRY_DSN the wrapper is a no-op: nothing is initialized, nothing
// is captured and nothing is flushed, so local runs and CI need no account.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sentryMock = vi.hoisted(() => ({
  captureException: vi.fn(),
  flush: vi.fn(() => Promise.resolve(true)),
  init: vi.fn(),
  withScope: vi.fn(),
}));

vi.mock('@sentry/node', () => sentryMock);
vi.mock('#config/env.js', () => ({
  default: {
    NODE_ENV: 'test',
    SENTRY_DSN: undefined,
    SENTRY_ENVIRONMENT: 'test',
    SENTRY_TRACES_SAMPLE_RATE: 0,
  },
}));

import {
  flushSentry,
  initSentry,
  isSentryEnabled,
  reportError,
  reportFatal,
} from '#lib/sentry.js';

describe('Sentry without a DSN', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    initSentry();
  });

  it('stays disabled and never initializes the SDK', () => {
    expect(isSentryEnabled()).toBe(false);
    expect(sentryMock.init).not.toHaveBeenCalled();
  });

  it('reports nothing', async () => {
    reportError(new Error('boom'), { requestId: 'r1', userId: 'staff:1' });
    await reportFatal(new Error('fatal'), 'uncaughtException');

    expect(sentryMock.withScope).not.toHaveBeenCalled();
    expect(sentryMock.captureException).not.toHaveBeenCalled();
  });

  it('flushes nothing', async () => {
    await flushSentry();

    expect(sentryMock.flush).not.toHaveBeenCalled();
  });
});
