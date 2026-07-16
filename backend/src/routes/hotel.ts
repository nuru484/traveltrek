// src/routes/hotel.ts
import { Router } from 'express';

import {
  createHotel,
  deleteHotel,
  getAllHotels,
  getHotel,
  updateHotel,
} from '#controllers/index.js';
import { authorizeRole } from '#middlewares/authorize-roles.js';
import { UserRole } from '#types/user-profile.types.js';

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

export default hotelRoutes;
