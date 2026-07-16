// src/utils/mappers/user.mapper.ts
//
// Pure DTO mapper for the user domain. Services return Prisma rows selected
// through `userSelect`; controllers map them through here so the wire format
// lives in exactly one place and raw DB records never leak.
//
// The password is excluded at the SELECT, not stripped afterwards, so it can
// never appear in a DTO. toUserDTO reproduces the legacy read responses
// bit-for-bit: nullable columns are mapped to undefined (dropped from the
// JSON), and role is narrowed to the shared UserRole enum.
import type { Prisma } from '../../config/prismaClient';

import { UserRole } from '../../../types/user-profile.types';

/** Every user column except password; services pass this to Prisma. */
export const userSelect = {
  address: true,
  createdAt: true,
  email: true,
  id: true,
  name: true,
  phone: true,
  profilePicture: true,
  role: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export type SafeUser = Prisma.UserGetPayload<{ select: typeof userSelect }>;

export interface UserDTO {
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

export const toUserDTO = (user: SafeUser): UserDTO => ({
  address: user.address ?? undefined,
  createdAt: user.createdAt,
  email: user.email,
  id: user.id,
  name: user.name,
  phone: user.phone ?? undefined,
  profilePicture: user.profilePicture ?? undefined,
  role: user.role as UserRole,
  updatedAt: user.updatedAt,
});
