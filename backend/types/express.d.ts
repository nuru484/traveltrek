// types/express.d.ts
import 'express';
import type { Logger } from 'pino';

import { AccessTokenPayload } from './auth.types.js';

declare module 'express' {
  export interface Request {
    /** Per-request child logger pre-tagged with requestId (set by request-id middleware). */
    log?: Logger;
    /** Raw request bytes, captured by express.json's verify hook in app.ts
     * (used for webhook HMAC signature verification). */
    rawBody?: Buffer;
    /** Correlation id for this request (sanitized inbound x-request-id or generated). */
    requestId?: string;
    /** Decoded access-token payload, set by authenticate-jwt. */
    user?: AccessTokenPayload;
  }
}
