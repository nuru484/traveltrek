// Enum
export enum UserRole {
  ADMIN = 'ADMIN',
  AGENT = 'AGENT',
  CUSTOMER = 'CUSTOMER',
}

export interface IUser {
  address?: string;
  createdAt: Date;
  email: string;
  id: number;
  name: string;
  phone: string;
  profilePicture?: string;
  role: UserRole;
  updatedAt: Date;
}

export interface IUserRegistrationInput {
  address?: string;
  email: string;
  name: string;
  password: string;
  phone: string;
  profilePicture?: string;
  role: UserRole;
}

export interface IUserResponseData {
  address?: string;
  createdAt: Date;
  email: string;
  id: number;
  name: string;
  phone?: string;
  profilePicture?: string;
  role: UserRole;
  updatedAt: Date;
}

export interface IUsersPaginatedResponse {
  data: IUserResponseData[];
  message: string;
  meta: {
    limit: number;
    page: number;
    total: number;
    totalPages: number;
  };
}

export interface IUserUpdateData {
  address?: string;
  email?: string;
  name?: string;
  password?: string;
  phone?: string;
  profilePicture?: string;
}

export interface IUserUpdateInput {
  address?: string;
  email?: string;
  name?: string;
  password?: string;
  phone?: string;
  profilePicture?: Express.Multer.File | string;
}
