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

// Authentication routes
routes.use('/', authenticationRouter);

// Payment routes
routes.use(paymentRoutes);

routes.use(authenticateJWT);

// Tour routes
routes.use(tourRoutes);

// Destination routes
routes.use(destinationRoutes);

// Hotel routes
routes.use(hotelRoutes);

// Flight routes
routes.use(flightRoutes);

// Booking routes
routes.use(bookingRoutes);

// Room routes
routes.use(roomRoutes);


// User routes
routes.use(userRoutes);

// Dashboard routes
routes.use(dashboardRoutes);

// Reports routes
routes.use(reportsRoutes);

export default routes;
