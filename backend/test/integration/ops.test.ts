// test/integration/ops.test.ts
//
// Ops hardening: health probes (mounted before the rate limiter),
// request correlation (X-Request-Id echo + requestId in error envelopes),
// and helmet security headers.
import { describe, expect, it } from 'vitest';

import { api } from '../helpers/auth.js';

describe('health endpoints', () => {
  it('GET /health answers 200 statically (liveness)', async () => {
    const res = await api().get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok' });
  });

  it('GET /health/ready verifies the database and answers ready', async () => {
    const res = await api().get('/health/ready');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ready' });
  });

  it('GET /health/db runs an on-demand deep database check', async () => {
    const res = await api().get('/health/db');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok' });
  });
});

describe('request correlation', () => {
  it('echoes a sanitized inbound x-request-id on the response', async () => {
    const inbound = 'test-req-id_1234.abc';
    const res = await api().get('/health').set('x-request-id', inbound);

    expect(res.headers['x-request-id']).toBe(inbound);
  });

  it('generates an X-Request-Id when none is supplied', async () => {
    const res = await api().get('/health');

    expect(res.headers['x-request-id']).toMatch(/^[\w.-]{1,64}$/);
  });

  it('replaces an unsafe inbound x-request-id instead of echoing it', async () => {
    const res = await api()
      .get('/health')
      .set('x-request-id', 'bad id with spaces!!');

    expect(res.headers['x-request-id']).toBeDefined();
    expect(res.headers['x-request-id']).not.toBe('bad id with spaces!!');
    expect(res.headers['x-request-id']).toMatch(/^[\w.-]{1,64}$/);
  });

  it('includes the requestId in error response envelopes', async () => {
    // Unauthenticated hit on a protected route goes through the errorHandler.
    const res = await api()
      .get('/api/v1/users')
      .set('x-request-id', 'err-corr-test-1');

    expect(res.status).toBe(401);
    expect(res.body.status).toBe('error');
    expect(res.body.requestId).toBe('err-corr-test-1');
    expect(res.headers['x-request-id']).toBe('err-corr-test-1');
  });
});

describe('security headers (helmet)', () => {
  it('sets baseline helmet headers', async () => {
    const res = await api().get('/health');

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toBeDefined();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
