// types/express.d.ts
import 'express';

import { AccessTokenPayload } from './auth.types.js';

declare module 'express' {
  export interface Request {
    /** Raw request bytes, captured by express.json's verify hook in app.ts
     * (used for webhook HMAC signature verification). */
    rawBody?: Buffer;
    /** Decoded access-token payload, set by authenticate-jwt. */
    user?: AccessTokenPayload;
  }
}
