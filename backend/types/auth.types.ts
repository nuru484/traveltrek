import { Request } from 'express';

import { UserRole } from './user-profile.types';

export interface ILoginRequest extends Request {
  body: {
    email: string;
    password: string;
  };
}

export interface IRefreshTokenPayload {
  id: number;
}

export interface ITokenPayload {
  id: number;
  role: UserRole;
}

export interface IUserLoginInput {
  email: string;
  password: string;
}
