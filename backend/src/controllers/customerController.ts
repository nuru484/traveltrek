// src/controllers/customerController.ts
//
// Thin HTTP adapters for the customers domain (Phase 5b): each export is a
// RequestHandler bundle of [multer/picture middleware where relevant, zod
// validation middleware, asyncHandler(handler)]. Handlers read the typed
// req.query/body/params the middleware wrote back, call the customer service,
// and reply through the standard envelope helpers. All domain logic
// (uniqueness checks, password hashing, delete guards, Cloudinary cleanup,
// the self-vs-staff actor rule) lives in services/customer.service.ts.
//
// The `!user` guards below only narrow the optional type (authenticate-jwt
// always sets req.user) and fail closed if middleware order ever breaks.
import { Request, RequestHandler, Response } from 'express';

import {
  CLOUDINARY_UPLOAD_OPTIONS,
  HTTP_STATUS_CODES,
} from '#config/constants.js';
import multerUpload from '#config/multer.js';
import conditionalCloudinaryUpload from '#middlewares/conditional-cloudinary-upload.js';
import {
  asyncHandler,
  UnauthorizedError,
} from '#middlewares/error-handler.js';
import zodValidation from '#middlewares/validate-request.js';
import {
  createCustomer as createCustomerService,
  type CustomerActor,
  deleteCustomer as deleteCustomerService,
  getCustomerById as getCustomerByIdService,
  listCustomerBookingHistory,
  listCustomerPaymentHistory,
  listCustomers,
  updateCustomer as updateCustomerService,
} from '#services/customer.service.js';
import { AccessTokenPayload } from '#types/auth.types.js';
import { buildPaginationMeta, sendPaginated, sendSuccess } from '#utils/http-response.js';
import { toBookingDTO } from '#utils/mappers/booking.mapper.js';
import {
  toCustomerDTO,
  toCustomerProfileDTO,
} from '#utils/mappers/customer.mapper.js';
import { toPaymentDTO } from '#utils/mappers/payment.mapper.js';
import { intParam } from '#validations/common-validation.js';
import {
  CreateCustomerBody,
  createCustomerSchema,
  customerHistoryQuery,
  CustomerHistoryQueryInput,
  customerListQuery,
  CustomerListQueryInput,
  UpdateCustomerBody,
  updateCustomerSchema,
} from '#validations/customer-validation.js';

/** Reads the customer id that `intParam('id')` validated and coerced. */
const idParam = (req: Request): number =>
  (req.params as unknown as { id: number }).id;

const toActor = (user: AccessTokenPayload): CustomerActor => ({
  id: user.id,
  kind: user.kind,
  role: user.role,
});

const handleCreateCustomer = asyncHandler(
  async (req: Request, res: Response) => {
    const body = req.body as CreateCustomerBody;

    const customer = await createCustomerService({
      address: body.address,
      email: body.email,
      name: body.name,
      password: body.password,
      phone: body.phone,
      profilePicture: body.profilePicture,
    });

    sendSuccess(res, {
      data: toCustomerDTO(customer),
      message: 'Customer created successfully.',
      status: HTTP_STATUS_CODES.CREATED,
    });
  },
);
export const createCustomer: RequestHandler[] = [
  ...zodValidation.body(createCustomerSchema),
  handleCreateCustomer,
];

const handleGetAllCustomers = asyncHandler(
  async (req: Request, res: Response) => {
    const query = req.query as unknown as CustomerListQueryInput;
    const { customers, total } = await listCustomers(query);

    sendPaginated(res, {
      data: customers.map(toCustomerDTO),
      limit: query.limit,
      message: 'Customers retrieved successfully',
      page: query.page,
      total,
    });
  },
);
export const getAllCustomers: RequestHandler[] = [
  ...zodValidation.query(customerListQuery),
  handleGetAllCustomers,
];

const handleGetCustomerById = asyncHandler(
  async (req: Request, res: Response) => {
    const { user } = req;
    if (!user) {
      throw new UnauthorizedError(
        'You are not authorized to view this customer profile',
      );
    }

    const { customer, stats } = await getCustomerByIdService(
      toActor(user),
      idParam(req),
    );

    sendSuccess(res, {
      data: toCustomerProfileDTO(customer, stats),
      message: 'Customer retrieved successfully',
    });
  },
);
export const getCustomerById: RequestHandler[] = [
  ...zodValidation.params(intParam('id')),
  handleGetCustomerById,
];

const handleGetCustomerBookings = asyncHandler(
  async (req: Request, res: Response) => {
    const { user } = req;
    if (!user) throw new UnauthorizedError('Unauthorized, no user provided');

    const customerId = idParam(req);
    const query = req.query as unknown as CustomerHistoryQueryInput;
    const { bookings, total } = await listCustomerBookingHistory(
      toActor(user),
      customerId,
      query,
    );

    sendSuccess(res, {
      data: bookings.map(toBookingDTO),
      message: `Bookings for customer ${String(customerId)} retrieved successfully`,
      meta: buildPaginationMeta(total, query.page, query.limit),
    });
  },
);
export const getCustomerBookingHistory: RequestHandler[] = [
  ...zodValidation.params(intParam('id')),
  ...zodValidation.query(customerHistoryQuery),
  handleGetCustomerBookings,
];

const handleGetCustomerPayments = asyncHandler(
  async (req: Request, res: Response) => {
    const { user } = req;
    if (!user) throw new UnauthorizedError('Unauthorized, no user provided');

    const customerId = idParam(req);
    const query = req.query as unknown as CustomerHistoryQueryInput;
    const { payments, total } = await listCustomerPaymentHistory(
      toActor(user),
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
export const getCustomerPaymentHistory: RequestHandler[] = [
  ...zodValidation.params(intParam('id')),
  ...zodValidation.query(customerHistoryQuery),
  handleGetCustomerPayments,
];

const handleUpdateCustomer = asyncHandler(
  async (req: Request, res: Response) => {
    // Read after conditionalCloudinaryUpload ran: an uploaded file's
    // Cloudinary URL has been written onto the parsed body's profilePicture.
    const body = req.body as UpdateCustomerBody;
    const { user } = req;
    if (!user) {
      throw new UnauthorizedError(
        'You are not authorized to update this customer.',
      );
    }

    const updated = await updateCustomerService(toActor(user), idParam(req), {
      address: body.address,
      email: body.email,
      name: body.name,
      password: body.password,
      phone: body.phone,
      profilePicture: body.profilePicture,
    });

    sendSuccess(res, {
      data: toCustomerDTO(updated),
      message: 'Customer updated successfully.',
    });
  },
);
export const updateCustomer: RequestHandler[] = [
  multerUpload.single('profilePicture'),
  ...zodValidation.params(intParam('id')),
  ...zodValidation.body(updateCustomerSchema),
  conditionalCloudinaryUpload(CLOUDINARY_UPLOAD_OPTIONS, 'profilePicture'),
  handleUpdateCustomer,
];

const handleDeleteCustomer = asyncHandler(
  async (req: Request, res: Response) => {
    const deleted = await deleteCustomerService(idParam(req));

    sendSuccess(res, {
      message: `Customer "${deleted.name}" (${deleted.email ?? 'no email'}) deleted successfully`,
    });
  },
);
export const deleteCustomer: RequestHandler[] = [
  ...zodValidation.params(intParam('id')),
  handleDeleteCustomer,
];
