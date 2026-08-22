// src/controllers/paymentController.ts
//
// Thin HTTP adapters for the payment domain: each export is a RequestHandler
// bundle of [zod validation middleware, asyncHandler(handler)]. Handlers read
// the typed req.query/body/params the middleware wrote back, call the payment
// service, and reply through the standard envelope helpers. All domain logic
// (booking gates, Paystack I/O, reconciliation, transition/delete guards)
// lives in services/payment.service.ts.
//
// Like bookings, the payment role rules are NOT enforced by
// routes/payment.ts: they live in the service as actor-based rules, so each
// handler passes `{ id, role }` down. The `!user` guards below only narrow
// the optional type (authenticate-jwt always sets req.user) and fail closed.
//
// Two endpoints answer with bespoke envelopes instead of sendSuccess:
// - handleWebhook (public, mounted before authenticateJWT) verifies the
//   Paystack HMAC over the RAW request bytes (req.rawBody, captured in
//   app.ts); hashing a re-serialized JSON.stringify(req.body) breaks whenever
//   re-serialization differs from the wire bytes. Response codes: 400
//   'Invalid signature', otherwise 200s (Paystack retries anything else).
// - handleCallback translates the service's verification outcome into a
//   `{ message, success, data? }` shape with its own status codes.
import { Request, RequestHandler, Response } from 'express';

import { HTTP_STATUS_CODES } from '#config/constants.js';
import { verifyPaystackSignature } from '#lib/paystack.js';
import {
  asyncHandler,
  UnauthorizedError,
} from '#middlewares/error-handler.js';
import zodValidation from '#middlewares/validate-request.js';
import {
  deletePayment as deletePaymentService,
  getPaymentById,
  handleWebhookEvent,
  initializePayment,
  listCustomerPayments,
  listPayments,
  type PaystackWebhookEvent,
  refundPayment as refundPaymentService,
  updatePaymentStatus as updatePaymentStatusService,
  verifyPaymentCallback,
} from '#services/payment.service.js';
import {
  IPaymentStatus,
  IPaymentVerificationResponse,
} from '#types/payment.types.js';
import { buildPaginationMeta, sendSuccess } from '#utils/http-response.js';
import { toPaymentDTO } from '#utils/mappers/payment.mapper.js';
import { intParam } from '#validations/common-validation.js';
import {
  CreatePaymentBody,
  createPaymentSchema,
  customerPaymentsQuery,
  CustomerPaymentsQueryInput,
  paymentListQuery,
  PaymentListQueryInput,
  RefundPaymentBody,
  refundPaymentSchema,
  UpdatePaymentStatusBody,
  updatePaymentStatusSchema,
} from '#validations/payment-validation.js';

/** Reads the payment id that `intParam('id')` validated and coerced. */
const idParam = (req: Request): number =>
  (req.params as unknown as { id: number }).id;

const handleCreatePayment = asyncHandler(
  async (req: Request, res: Response) => {
    const body = req.body as CreatePaymentBody;
    const { user } = req;
    if (!user) throw new UnauthorizedError('Unauthorized access');

    const result = await initializePayment(
      { id: user.id, role: user.role },
      { bookingId: body.bookingId, paymentMethod: body.paymentMethod },
    );

    sendSuccess(res, {
      data: {
        authorization_url: result.authorizationUrl,
        paymentId: result.paymentId,
        transactionReference: result.transactionReference,
      },
      message: result.resumed
        ? 'Payment session resumed'
        : 'Payment initialized successfully',
    });
  },
);
export const createPayment: RequestHandler[] = [
  ...zodValidation.body(createPaymentSchema),
  handleCreatePayment,
];

// GET /payments/callback: bespoke `{ message, success, data? }` envelope
// (no zod: a missing reference has its own 400).
const handlePaymentCallback = asyncHandler(
  async (req: Request, res: Response<IPaymentVerificationResponse>) => {
    const { reference } = req.query;

    if (!reference || typeof reference !== 'string') {
      res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        message: 'No reference provided',
        success: false,
      });
      return;
    }

    const result = await verifyPaymentCallback(reference);

    if (result.kind === 'no_booking_id') {
      res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        message: 'No bookingId found in payment metadata',
        success: false,
      });
      return;
    }

    if (result.kind === 'booking_not_found') {
      res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        message: 'Booking not found',
        success: false,
      });
      return;
    }

    const completed = result.kind === 'completed';
    const paymentStatus: IPaymentStatus = completed ? 'COMPLETED' : 'FAILED';
    const message = completed
      ? 'Payment verified successfully'
      : result.kind === 'amount_mismatch'
        ? 'Payment amount does not match booking total price'
        : 'Payment verification failed';

    res.status(HTTP_STATUS_CODES.OK).json({
      data: {
        amount: result.amount,
        bookingId: result.bookingId,
        paymentStatus,
        reference: result.reference,
      },
      message,
      success: completed,
    });
  },
);
export const handleCallback: RequestHandler[] = [handlePaymentCallback];

// POST /payments/webhook — public (mounted before authenticateJWT in
// routes/payment.ts). Signature first, over the raw bytes; then the service
// processes the event. Paystack expects 200s for anything it should not retry.
const handlePaystackWebhook = asyncHandler(
  async (req: Request, res: Response) => {
    const signature = req.headers['x-paystack-signature'];

    if (
      !req.rawBody ||
      !verifyPaystackSignature(
        req.rawBody,
        typeof signature === 'string' ? signature : undefined,
      )
    ) {
      res.status(HTTP_STATUS_CODES.BAD_REQUEST).send('Invalid signature');
      return;
    }

    const outcome = await handleWebhookEvent(req.body as PaystackWebhookEvent);

    sendSuccess(res, {
      message:
        outcome === 'confirmed'
          ? 'Payment verified and booking confirmed'
          : 'Event received',
    });
  },
);
export const handleWebhook: RequestHandler[] = [handlePaystackWebhook];

const handleGetPayment = asyncHandler(async (req: Request, res: Response) => {
  const { user } = req;
  if (!user) throw new UnauthorizedError('Unauthorized, no user provided');

  const payment = await getPaymentById(
    { id: user.id, role: user.role },
    idParam(req),
  );

  sendSuccess(res, {
    data: toPaymentDTO(payment),
    message: 'Payment retrieved successfully',
  });
});
export const getPayment: RequestHandler[] = [
  ...zodValidation.params(intParam('id')),
  handleGetPayment,
];

const handleGetAllPayments = asyncHandler(
  async (req: Request, res: Response) => {
    const { user } = req;
    if (!user) throw new UnauthorizedError('Unauthorized, no user provided');

    const query = req.query as unknown as PaymentListQueryInput;
    const { payments, total } = await listPayments(
      { id: user.id, role: user.role },
      query,
    );

    sendSuccess(res, {
      data: payments.map(toPaymentDTO),
      message: 'Payments retrieved successfully',
      meta: buildPaginationMeta(total, query.page, query.limit),
    });
  },
);
export const getAllPayments: RequestHandler[] = [
  ...zodValidation.query(paymentListQuery),
  handleGetAllPayments,
];

const handleGetCustomerPayments = asyncHandler(
  async (req: Request, res: Response) => {
    const { user } = req;
    if (!user) throw new UnauthorizedError('Unauthorized, no user provided');

    const customerId = (req.params as unknown as { customerId: number })
      .customerId;
    const query = req.query as unknown as CustomerPaymentsQueryInput;
    const { payments, total } = await listCustomerPayments(
      { id: user.id, role: user.role },
      customerId,
      query,
    );

    sendSuccess(res, {
      data: payments.map(toPaymentDTO),
      message: `Payments for customer ${String(customerId)} retrieved successfully`,
      meta: buildPaginationMeta(total, query.page, query.limit),
    });
  },
);
export const getCustomerPayments: RequestHandler[] = [
  ...zodValidation.params(intParam('customerId')),
  ...zodValidation.query(customerPaymentsQuery),
  handleGetCustomerPayments,
];

const handleUpdatePaymentStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const body = req.body as UpdatePaymentStatusBody;
    const { user } = req;
    if (!user) throw new UnauthorizedError('Unauthorized, no user provided');

    const { bookingStatus, payment } = await updatePaymentStatusService(
      { id: user.id, role: user.role },
      idParam(req),
      body.status,
    );

    sendSuccess(res, {
      data: {
        bookingStatus,
        paymentId: payment.id,
        status: payment.status,
        updatedAt: payment.updatedAt,
      },
      message: 'Payment status updated successfully',
    });
  },
);
export const updatePaymentStatus: RequestHandler[] = [
  ...zodValidation.params(intParam('id')),
  ...zodValidation.body(updatePaymentStatusSchema),
  handleUpdatePaymentStatus,
];

const handleRefundPayment = asyncHandler(
  async (req: Request, res: Response) => {
    const body = req.body as RefundPaymentBody;
    const { user } = req;
    if (!user) throw new UnauthorizedError('Unauthorized, no user provided');

    const summary = await refundPaymentService(
      { id: user.id, role: user.role },
      idParam(req),
      body.reason,
    );

    sendSuccess(res, {
      data: {
        bookingStatus: summary.bookingStatus,
        paymentId: summary.payment.id,
        reason: summary.reason,
        refundAmount: summary.refundAmount,
        status: summary.payment.status,
        updatedAt: summary.payment.updatedAt,
      },
      message: 'Payment refunded successfully',
    });
  },
);
export const refundPayment: RequestHandler[] = [
  ...zodValidation.params(intParam('id')),
  ...zodValidation.body(refundPaymentSchema),
  handleRefundPayment,
];

const handleDeletePayment = asyncHandler(
  async (req: Request, res: Response) => {
    const { user } = req;
    if (!user) throw new UnauthorizedError('Unauthorized, no user provided');

    const summary = await deletePaymentService(
      { id: user.id, role: user.role },
      idParam(req),
    );

    sendSuccess(res, {
      data: summary,
      message: 'Payment deleted successfully',
    });
  },
);
export const deletePayment: RequestHandler[] = [
  ...zodValidation.params(intParam('id')),
  handleDeletePayment,
];
