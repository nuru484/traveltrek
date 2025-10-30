// src/routes/hotel.ts
import { Router } from 'express';
import {
  createHotel,
  getHotel,
  updateHotel,
  deleteHotel,
  getAllHotels,
  deleteAllHotels,
} from '../controllers/index';
import { authorizeRole } from '../middlewares/authorize-roles';
import { UserRole } from '../../types/user-profile.types';

const hotelRoutes = Router();

hotelRoutes.post('/hotels', authorizeRole([UserRole.ADMIN]), createHotel);

hotelRoutes.get(
  '/hotels/:id',
  authorizeRole([UserRole.ADMIN, UserRole.AGENT, UserRole.CUSTOMER]),
  getHotel,
);

hotelRoutes.put('/hotels/:id', authorizeRole([UserRole.ADMIN]), updateHotel);

hotelRoutes.delete('/hotels/:id', authorizeRole([UserRole.ADMIN]), deleteHotel);

hotelRoutes.get(
  '/hotels',
  authorizeRole([UserRole.ADMIN, UserRole.AGENT, UserRole.CUSTOMER]),
  getAllHotels,
);

hotelRoutes.delete('/hotels', authorizeRole([UserRole.ADMIN]), deleteAllHotels);

export default hotelRoutes;
