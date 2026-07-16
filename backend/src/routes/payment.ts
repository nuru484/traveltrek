import { Router } from 'express';

import {
  createPayment,
  deleteAllPayments,
  deletePayment,
  getAllPayments,
  getPayment,
  getUserPayments,
  handleCallback,
  handleWebhook,
  refundPayment,
  updatePaymentStatus,
} from '#controllers/index.js';
import authenticateJWT from '#middlewares/authenticate-jwt.js';

const paymentRoutes = Router();

paymentRoutes.post('/payments/webhook', handleWebhook);

paymentRoutes.use(authenticateJWT);

paymentRoutes.patch('/payments/:id', updatePaymentStatus);
paymentRoutes.patch('/payments/:id/refund', refundPayment);
paymentRoutes.delete('/payments/:id', deletePayment);
paymentRoutes.delete('/payments', deleteAllPayments);
paymentRoutes.post('/payments', createPayment);
paymentRoutes.get('/payments/callback', handleCallback);
paymentRoutes.get('/payments/:id', getPayment);
paymentRoutes.get('/payments', getAllPayments);
paymentRoutes.get('/payments/user/:userId', getUserPayments);

export default paymentRoutes;
