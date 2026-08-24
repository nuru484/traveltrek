// test/unit/access-log.test.ts
//
// The access log is structured pino output: every completion line carries the
// same requestId the client sees, the level follows the status code, and
// platform probes are not logged.
import express from 'express';
import { Writable } from 'node:stream';
import { pino } from 'pino';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createAccessLog } from '#middlewares/access-log.js';
import { requestId } from '#middlewares/request-id.js';

const buildApp = () => {
  const lines: Record<string, unknown>[] = [];
  const sink = new Writable({
    write(chunk: Buffer, _enc, cb) {
      lines.push(JSON.parse(chunk.toString()) as Record<string, unknown>);
      cb();
    },
  });
  const app = express();
  app.use(requestId);
  app.use(createAccessLog(pino(sink)));
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.get('/health/ready', (_req, res) => res.json({ status: 'ready' }));
  app.get('/ready', (_req, res) => res.json({ status: 'ready' }));
  app.get('/ok', (req, res) => {
    req.log.info('inside handler');
    res.json({ ok: true });
  });
  app.get('/boom', (_req, res) => res.status(500).json({}));
  return { app, lines };
};

describe('access log', () => {
  it('stamps the response requestId on the completion line', async () => {
    const { app, lines } = buildApp();

    const res = await request(app).get('/ok').set('x-request-id', 'abc-123');

    expect(res.headers['x-request-id']).toBe('abc-123');
    const completion = lines.find((l) => l.res !== undefined);
    expect(completion).toBeDefined();
    expect(completion!.requestId).toBe('abc-123');
    expect(lines).toHaveLength(2);
  });

  it('keeps req.log stamped with the requestId for handler logs', async () => {
    const { app, lines } = buildApp();

    await request(app).get('/ok').set('x-request-id', 'abc-123');

    const inner = lines.find((l) => l.msg === 'inside handler');
    expect(inner!.requestId).toBe('abc-123');
    expect(inner!.req).toBeUndefined();
  });

  it('maps status codes to levels: 5xx error, 4xx warn, else info', async () => {
    const { app, lines } = buildApp();

    await request(app).get('/ok');
    await request(app).get('/missing');
    await request(app).get('/boom');

    const levels = lines.filter((l) => l.res !== undefined).map((l) => l.level);
    expect(levels).toEqual([30, 40, 50]);
  });

  it('skips liveness and readiness probes', async () => {
    const { app, lines } = buildApp();

    await request(app).get('/health');
    await request(app).get('/health/ready');
    await request(app).get('/ready');

    expect(lines).toHaveLength(0);
  });
});
