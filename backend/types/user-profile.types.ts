// Enum
export enum UserRole {
  ADMIN = 'ADMIN',
  CUSTOMER = 'CUSTOMER',
  AGENT = 'AGENT',
}

export interface IUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  phone: string;
  profilePicture?: string;
  address?: string;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: any;
}

export interface IUserRegistrationInput {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  phone: string;
  profilePicture?: string;
  address?: string;
}

export interface IUserResponseData {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  address?: string;
  profilePicture?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserUpdateInput {
  name?: string;
  email?: string;
  password?: string;
  phone?: string;
  address?: string;
  profilePicture?: string | Express.Multer.File;
}

export interface IUserUpdateData {
  name?: string;
  email?: string;
  password?: string;
  phone?: string;
  address?: string;
  profilePicture?: string;
}

export interface IUsersPaginatedResponse {
  message: string;
  data: IUserResponseData[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
