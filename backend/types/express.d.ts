// types/express.d.ts
import 'express';

import { IUser } from './user-profile.types';

declare module 'express' {
  export interface Request {
    /** Raw request bytes, captured by express.json's verify hook in app.ts
     * (used for webhook HMAC signature verification). */
    rawBody?: Buffer;
    user?: IUser;
  }
}
