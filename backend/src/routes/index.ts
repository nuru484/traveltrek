import express from 'express';
import authenticateJWT from '../middlewares/authenticate-jwt';
import { authenticationRouter } from './authentication';
import tourRoutes from './tour';
import destinationRoutes from './destination';
import hotelRoutes from './hotel';
import flightRoutes from './flight';
import bookingRoutes from './booking';
import paymentRoutes from './payment';
import roomRoutes from './room';
import userRoutes from './user';
import dashboardRoutes from './dashboard';
import reportsRoutes from './reports';

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
