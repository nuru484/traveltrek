import { Request } from 'express';
import { UserRole } from './user-profile.types';

export interface ILoginRequest extends Request {
  body: {
    password: string;
    email: string;
  };
}

export interface IUserLoginInput {
  password: string;
  email: string;
}

export interface ITokenPayload {
  id: number;
  role: UserRole;
}

export interface IRefreshTokenPayload {
  id: number;
}
