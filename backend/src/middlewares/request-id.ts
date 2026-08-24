import { NextFunction, Request, Response } from 'express';
// src/middlewares/request-id.ts
//
// Request correlation. Honors an inbound `x-request-id` (so a value set by an
// upstream proxy / the frontend flows straight through) or generates one, then:
//   - stashes it on `req.requestId`,
//   - echoes it back on the `X-Request-Id` response header,
//   - runs the rest of the chain inside the async request context so code
//     with no `req` in scope can still read the id.
// The access-log middleware that follows reuses the id and sets `req.log`.
// The error handler ties this to the `errorId` it mints, so a client-visible
// error maps to exactly the server log lines for that request.
import { randomUUID } from 'node:crypto';

import { requestContext } from '#lib/request-context.js';

const HEADER = 'x-request-id';

// An inbound id is echoed back verbatim and stamped onto every log line, so it
// can't be trusted raw: a client could inject control chars / log-forging
// newlines or an oversized value. Accept it only when it's a conservative,
// URL/log-safe token (alphanumerics, dash, underscore, dot) of a sane length —
// this covers UUIDs and typical proxy-generated ids — otherwise mint a fresh one.
const SAFE_REQUEST_ID = /^[\w.-]{1,64}$/;

export const requestId = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const inbound = req.get(HEADER)?.trim();
  const id = inbound && SAFE_REQUEST_ID.test(inbound) ? inbound : randomUUID();

  req.requestId = id;
  res.setHeader('X-Request-Id', id);

  requestContext.run({ requestId: id }, next);
};

export default requestId;
