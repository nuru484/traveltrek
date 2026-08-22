import { Router } from 'express';

import {
  createPayment,
  deletePayment,
  getAllPayments,
  getCustomerPayments,
  getPayment,
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
paymentRoutes.post('/payments', createPayment);
paymentRoutes.get('/payments/callback', handleCallback);
paymentRoutes.get('/payments/:id', getPayment);
paymentRoutes.get('/payments', getAllPayments);
// Payments hang off Customers, so the per-owner listing is keyed by
// customerId; there is no /payments/user/:userId alias.
paymentRoutes.get('/payments/customer/:customerId', getCustomerPayments);

export default paymentRoutes;
