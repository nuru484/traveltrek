import express from 'express';

import authenticateJWT from '#middlewares/authenticate-jwt.js';
import { authenticationRouter } from '#routes/authentication/index.js';
import bookingRoutes from '#routes/booking.js';
import customerRoutes from '#routes/customer.js';
import dashboardRoutes from '#routes/dashboard.js';
import destinationRoutes from '#routes/destination.js';
import flightRoutes from '#routes/flight.js';
import hotelRoutes from '#routes/hotel.js';
import paymentRoutes from '#routes/payment.js';
import reportsRoutes from '#routes/reports.js';
import roomRoutes from '#routes/room.js';
import tourRoutes from '#routes/tour.js';
import userRoutes from '#routes/user.js';

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

routes.use(customerRoutes);

routes.use(dashboardRoutes);

routes.use(reportsRoutes);

export default routes;
