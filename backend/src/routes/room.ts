import { Router } from 'express';
import {
  createRoom,
  getRoom,
  updateRoom,
  deleteRoom,
  getAllRooms,
  deleteAllRooms,
} from '../controllers/index';
import { authorizeRole } from '../middlewares/authorize-roles';
import { UserRole } from '../../types/user-profile.types';

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
