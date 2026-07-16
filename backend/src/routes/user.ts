// src/routes/user.ts
//
// STAFF management (Phase 5b): every endpoint is staff-gated — customers have
// their own /customers surface and never touch /users anymore.
import { Router } from 'express';

import { adminCreateUser } from '#controllers/authentication/index.js';
import {
  changeUserRole,
  deleteAllUsers,
  deleteUser,
  getAllUsers,
  getUserById,
  updateUserProfile,
} from '#controllers/index.js';
import { authorizeRole } from '#middlewares/authorize-roles.js';
import { UserRole } from '#types/user-profile.types.js';

const userRoutes = Router();

userRoutes.post(
  '/users',
  authorizeRole([UserRole.ADMIN, UserRole.AGENT]),
  ...adminCreateUser,
);

userRoutes.put(
  '/users/:userId',
  authorizeRole([UserRole.ADMIN, UserRole.AGENT]),
  ...updateUserProfile,
);

userRoutes.get(
  '/users',
  authorizeRole([UserRole.ADMIN, UserRole.AGENT]),
  getAllUsers,
);

userRoutes.get(
  '/users/:userId',
  authorizeRole([UserRole.ADMIN, UserRole.AGENT]),
  getUserById,
);

userRoutes.patch(
  '/users/:userId/role',
  authorizeRole([UserRole.ADMIN]),
  changeUserRole,
);

userRoutes.delete(
  '/users/:userId',
  authorizeRole([UserRole.ADMIN]),
  deleteUser,
);

userRoutes.delete('/users', authorizeRole([UserRole.ADMIN]), deleteAllUsers);

export default userRoutes;
