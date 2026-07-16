import express from 'express';

import authenticateJWT from '../middlewares/authenticate-jwt';
import { authenticationRouter } from './authentication';
import bookingRoutes from './booking';
import dashboardRoutes from './dashboard';
import destinationRoutes from './destination';
import flightRoutes from './flight';
import hotelRoutes from './hotel';
import paymentRoutes from './payment';
import reportsRoutes from './reports';
import roomRoutes from './room';
import tourRoutes from './tour';
import userRoutes from './user';

const routes = express.Router();

routes.use('/', authenticationRouter);

routes.use(paymentRoutes);

routes.use(authenticateJWT);

routes.use(tourRoutes);

routes.use(destinationRoutes);

routes.use(hotelRoutes);

routes.use(flightRoutes);

routes.use(bookingRoutes);

routes.use(roomRoutes);

routes.use(userRoutes);

routes.use(dashboardRoutes);

routes.use(reportsRoutes);

export default routes;
