// src/routes/user.ts
import { Router } from 'express';
import {
  updateUserProfile,
  getAllUsers,
  getUserById,
  changeUserRole,
  deleteUser,
  deleteAllUsers,
} from '../controllers/index';
import { registerUser } from '../controllers/authentication/index';
import { authorizeRole } from '../middlewares/authorize-roles';
import { UserRole } from '../../types/user-profile.types';

const userRoutes = Router();

userRoutes.post(
  '/users',
  authorizeRole([UserRole.ADMIN, UserRole.AGENT]),
  ...registerUser,
);

userRoutes.put(
  '/users/:userId',
  authorizeRole([UserRole.ADMIN, UserRole.AGENT, UserRole.CUSTOMER]),
  ...updateUserProfile,
);

userRoutes.get('/users', authorizeRole([UserRole.ADMIN]), getAllUsers);

userRoutes.get(
  '/users/:userId',
  authorizeRole([UserRole.ADMIN, UserRole.AGENT, UserRole.CUSTOMER]),
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
