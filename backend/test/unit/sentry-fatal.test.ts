// test/unit/sentry-fatal.test.ts
//
// Process-level crash handlers must reach the tracker before the process
// exits: the report is tagged with its source and the client is flushed, so
// an unhandled rejection or uncaught exception is never lost on the way down.
// A crash-sourced shutdown also exits non-zero even after a clean drain, so
// the platform sees the failure; signal-driven shutdowns exit 0.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sentryMock = vi.hoisted(() => {
  const scope = { setContext: vi.fn(), setTag: vi.fn() };
  return {
    captureException: vi.fn(),
    flush: vi.fn(() => Promise.resolve(true)),
    init: vi.fn(),
    scope,
    withScope: vi.fn((cb: (s: typeof scope) => void) => {
      cb(scope);
    }),
  };
});

vi.mock('@sentry/node', () => sentryMock);
vi.mock('#config/env.js', () => ({
  default: {
    NODE_ENV: 'test',
    SENTRY_DSN: 'https://public@example.ingest.sentry.io/1',
    SENTRY_ENVIRONMENT: 'test',
    SENTRY_TRACES_SAMPLE_RATE: 0,
  },
}));

import { initSentry, reportFatal } from '#lib/sentry.js';
import { shutdownExitCode } from '#lib/shutdown.js';

describe('reportFatal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    initSentry();
  });

  it('captures the error tagged with its source, then flushes', async () => {
    const error = new Error('boom');

    await reportFatal(error, 'unhandledRejection');

    expect(sentryMock.captureException).toHaveBeenCalledWith(error);
    expect(sentryMock.scope.setContext).toHaveBeenCalledWith('request', {
      source: 'unhandledRejection',
    });
    expect(sentryMock.flush).toHaveBeenCalledWith(2000);
    expect(sentryMock.flush.mock.invocationCallOrder[0]).toBeGreaterThan(
      sentryMock.captureException.mock.invocationCallOrder[0],
    );
  });

  it('accepts a non-Error rejection reason', async () => {
    await reportFatal('string reason', 'uncaughtException');

    expect(sentryMock.captureException).toHaveBeenCalledWith('string reason');
    expect(sentryMock.flush).toHaveBeenCalledTimes(1);
  });
});

describe('shutdownExitCode', () => {
  it('exits 0 for platform signals', () => {
    expect(shutdownExitCode('SIGTERM')).toBe(0);
    expect(shutdownExitCode('SIGINT')).toBe(0);
  });

  it('exits 1 for crash-sourced shutdowns', () => {
    expect(shutdownExitCode('uncaughtException')).toBe(1);
    expect(shutdownExitCode('unhandledRejection')).toBe(1);
  });
});
