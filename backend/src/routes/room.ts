import { Router } from 'express';

import {
  createRoom,
  deleteAllRooms,
  deleteRoom,
  getAllRooms,
  getRoom,
  updateRoom,
} from '#controllers/index.js';
import { authorizeRole } from '#middlewares/authorize-roles.js';
import { UserRole } from '#types/user-profile.types.js';

const roomRoutes = Router();

roomRoutes.post('/rooms', authorizeRole([UserRole.ADMIN]), createRoom);

roomRoutes.get(
  '/rooms/:id',
  authorizeRole([UserRole.ADMIN, UserRole.AGENT, UserRole.CUSTOMER]),
  getRoom,
);

roomRoutes.put('/rooms/:id', authorizeRole([UserRole.ADMIN]), updateRoom);

roomRoutes.delete('/rooms/:id', authorizeRole([UserRole.ADMIN]), deleteRoom);

roomRoutes.get(
  '/rooms',
  authorizeRole([UserRole.ADMIN, UserRole.AGENT, UserRole.CUSTOMER]),
  getAllRooms,
);

roomRoutes.delete('/rooms', authorizeRole([UserRole.ADMIN]), deleteAllRooms);

export default roomRoutes;
