// test/unit/logger-request-id.test.ts
//
// Any line logged inside a request context carries that requestId, so
// service and job logs correlate with the access log without the id being
// passed through every call. Outside a context the field is simply absent.
import { Writable } from 'node:stream';
import { pino } from 'pino';
import { describe, expect, it, vi } from 'vitest';

import { requestContext } from '#lib/request-context.js';

const { requestContextMixin } =
  await vi.importActual<typeof import('#utils/logger.js')>('#utils/logger.js');

const captureLogger = () => {
  const lines: Record<string, unknown>[] = [];
  const sink = new Writable({
    write(chunk: Buffer, _enc, cb) {
      lines.push(JSON.parse(chunk.toString()) as Record<string, unknown>);
      cb();
    },
  });
  return { lines, logger: pino({ mixin: requestContextMixin }, sink) };
};

describe('logger request correlation', () => {
  it('stamps the current requestId on every line inside a context', () => {
    const { lines, logger } = captureLogger();

    requestContext.run({ requestId: 'ctx-log' }, () => {
      logger.info({ what: 'send' }, 'inside');
    });

    expect(lines[0]).toMatchObject({ requestId: 'ctx-log', what: 'send' });
  });

  it('adds nothing outside a request context', () => {
    const { lines, logger } = captureLogger();

    logger.info('outside');

    expect(lines[0]).not.toHaveProperty('requestId');
  });
});
