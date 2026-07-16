// types/express.d.ts
import 'express';

import { IUser } from './user-profile.types';

declare module 'express' {
  export interface Request {
    user?: IUser;
  }
}
