// test/unit/logger-redaction.test.ts
//
// The logger masks credentials at the sink, so a log call that forgets to
// scrub a request body or header can never leak a password, token or code.
import { Writable } from 'node:stream';
import { pino } from 'pino';
import { describe, expect, it, vi } from 'vitest';

const { redactOptions } =
  await vi.importActual<typeof import('#utils/logger.js')>('#utils/logger.js');

const captureLogger = () => {
  const lines: Record<string, unknown>[] = [];
  const sink = new Writable({
    write(chunk: Buffer, _enc, cb) {
      lines.push(JSON.parse(chunk.toString()) as Record<string, unknown>);
      cb();
    },
  });
  return { lines, logger: pino({ redact: redactOptions }, sink) };
};

describe('logger redaction', () => {
  it('masks credential fields nested anywhere in the payload', () => {
    const { lines, logger } = captureLogger();

    logger.info({
      body: {
        code: '123456',
        confirmPassword: 'hunter2',
        currentPassword: 'hunter2',
        email: 'jane@example.com',
        newPassword: 'hunter3',
        password: 'hunter2',
        phone: '+2348012345678',
        refreshToken: 'r.t',
        token: 'abc',
      },
    });

    const body = lines[0].body as Record<string, unknown>;
    expect(body.email).toBe('jane@example.com');
    for (const key of [
      'code',
      'confirmPassword',
      'currentPassword',
      'newPassword',
      'password',
      'phone',
      'refreshToken',
      'token',
    ]) {
      expect(body[key], key).toBe('[REDACTED]');
    }
  });

  it('masks auth headers on serialized requests and responses', () => {
    const { lines, logger } = captureLogger();

    logger.info({
      req: { headers: { authorization: 'Bearer x', cookie: 'accessToken=y' } },
      res: { headers: { 'set-cookie': ['accessToken=z'] } },
    });

    const req = lines[0].req as { headers: Record<string, unknown> };
    const res = lines[0].res as { headers: Record<string, unknown> };
    expect(req.headers.authorization).toBe('[REDACTED]');
    expect(req.headers.cookie).toBe('[REDACTED]');
    expect(res.headers['set-cookie']).toBe('[REDACTED]');
  });
});
