// test/unit/request-context.test.ts
//
// Code with no `req` in scope (services enqueueing jobs) still learns the
// current requestId through the request context, and a notification queued
// during a request carries that id so the job can be traced back to it.
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getRequestId, requestContext } from '#lib/request-context.js';
import { requestId } from '#middlewares/request-id.js';
import { makeQueuedNotify } from '#notifications/notify.js';

const queueMock = vi.hoisted(() => ({ add: vi.fn(() => Promise.resolve()) }));
vi.mock('#jobs/notificationQueue.js', () => ({
  notificationQueue: queueMock,
}));

describe('request context', () => {
  it('exposes the requestId to code running inside the request', async () => {
    const app = express();
    app.use(requestId);
    app.get('/', async (_req, res) => {
      await Promise.resolve();
      res.json({ seen: getRequestId() });
    });

    const res = await request(app).get('/').set('x-request-id', 'ctx-1');

    expect(res.body).toEqual({ seen: 'ctx-1' });
  });

  it('is undefined outside a request', () => {
    expect(getRequestId()).toBeUndefined();
  });
});

describe('queued notifications', () => {
  beforeEach(() => {
    queueMock.add.mockClear();
  });

  it('carry the originating requestId', async () => {
    const notify = makeQueuedNotify({
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
    } as never);

    requestContext.run({ requestId: 'ctx-2' }, () => {
      notify.sms({ message: 'hi', to: '+2348000000000' }, 'test sms');
    });
    await vi.waitFor(() => {
      expect(queueMock.add).toHaveBeenCalledTimes(1);
    });

    expect(queueMock.add).toHaveBeenCalledWith(
      'SMS',
      expect.objectContaining({ requestId: 'ctx-2', what: 'test sms' }),
    );
  });
});
