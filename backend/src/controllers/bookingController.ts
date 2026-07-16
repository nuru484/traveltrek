// src/controllers/bookingController.ts
//
// Thin HTTP adapters for the booking domain: each export is a RequestHandler
// bundle of [zod validation middleware, asyncHandler(handler)]. Handlers read
// the typed req.query/body/params the middleware wrote back, call the booking
// service, and reply through the standard envelope helpers. All domain logic
// (per-type availability, deadlines, counters, guard chains) lives in
// services/booking.service.ts.
//
// Unlike other converted domains, the booking role rules are NOT duplicated
// by routes/booking.ts, so they were moved into the service as actor-based
// rules rather than dropped: every handler that had an in-handler check
// passes `{ id, role }` down (create/get/list/user-list/delete/delete-all);
// updateBooking had none and still has none. The `!user` guards below only
// narrow the optional type (authenticate-jwt always sets req.user) and fail
// closed with the legacy messages if middleware order ever breaks.
import { Request, RequestHandler, Response } from 'express';

import { HTTP_STATUS_CODES } from '../config/constants';
import {
  asyncHandler,
  UnauthorizedError,
} from '../middlewares/error-handler';
import zodValidation from '../middlewares/validate-request';
import {
  createBooking as createBookingService,
  deleteAllBookings as deleteAllBookingsService,
  deleteBooking as deleteBookingService,
  getBookingById,
  listBookings,
  listUserBookings,
  updateBooking as updateBookingService,
} from '../services/booking.service';
import { buildPaginationMeta, sendSuccess } from '../utils/http-response';
import { toBookingDTO } from '../utils/mappers/booking.mapper';
import {
  bookingIdParam,
  bookingListQuery,
  BookingListQueryInput,
  bookingUserIdParam,
  CreateBookingBody,
  createBookingSchema,
  UpdateBookingBody,
  updateBookingSchema,
} from '../validations/booking-validation';

/** Reads the booking id that `bookingIdParam` validated and coerced. */
const idParam = (req: Request): number =>
  (req.params as unknown as { id: number }).id;

const handleCreateBooking = asyncHandler(
  async (req: Request, res: Response) => {
    const body = req.body as CreateBookingBody;
    const { user } = req;
    if (!user) throw new UnauthorizedError('Unauthorized, no user provided');

    const { booking, details } = await createBookingService(
      { id: user.id, role: user.role },
      {
        endDate: body.endDate,
        flightId: body.flightId,
        numberOfGuests: body.numberOfGuests,
        numberOfRooms: body.numberOfRooms,
        roomId: body.roomId,
        specialRequests: body.specialRequests,
        startDate: body.startDate,
        totalPrice: body.totalPrice,
        tourId: body.tourId,
        userId: body.userId,
      },
    );

    sendSuccess(res, {
      data: {
        ...toBookingDTO(booking),
        bookingDetails: details,
      },
      message: 'Booking created successfully',
      status: HTTP_STATUS_CODES.CREATED,
    });
  },
);
export const createBooking: RequestHandler[] = [
  ...zodValidation.body(createBookingSchema),
  handleCreateBooking,
];

const handleGetBooking = asyncHandler(async (req: Request, res: Response) => {
  const { user } = req;
  if (!user) throw new UnauthorizedError('Unauthorized, no user provided');

  const booking = await getBookingById(
    { id: user.id, role: user.role },
    idParam(req),
  );

  sendSuccess(res, {
    data: toBookingDTO(booking),
    message: 'Booking retrieved successfully',
  });
});
export const getBooking: RequestHandler[] = [
  ...zodValidation.params(bookingIdParam),
  handleGetBooking,
];

// The legacy update handler enforced no role rule (any authenticated
// ADMIN/AGENT/CUSTOMER the route admits may update) — preserved as-is.
const handleUpdateBooking = asyncHandler(
  async (req: Request, res: Response) => {
    const body = req.body as UpdateBookingBody;
    const booking = await updateBookingService(idParam(req), {
      endDate: body.endDate,
      flightId: body.flightId,
      numberOfGuests: body.numberOfGuests,
      numberOfRooms: body.numberOfRooms,
      roomId: body.roomId,
      specialRequests: body.specialRequests,
      startDate: body.startDate,
      status: body.status,
      totalPrice: body.totalPrice,
      tourId: body.tourId,
      userId: body.userId,
    });

    sendSuccess(res, {
      data: toBookingDTO(booking),
      message: 'Booking updated successfully',
    });
  },
);
export const updateBooking: RequestHandler[] = [
  ...zodValidation.params(bookingIdParam),
  ...zodValidation.body(updateBookingSchema),
  handleUpdateBooking,
];

const handleDeleteBooking = asyncHandler(
  async (req: Request, res: Response) => {
    const { user } = req;
    if (!user) throw new UnauthorizedError('Unauthorized, no user provided');

    const summary = await deleteBookingService(
      { id: user.id, role: user.role },
      idParam(req),
    );

    sendSuccess(res, {
      data: summary,
      message: 'Booking deleted successfully',
    });
  },
);
export const deleteBooking: RequestHandler[] = [
  ...zodValidation.params(bookingIdParam),
  handleDeleteBooking,
];

const handleGetUserBookings = asyncHandler(
  async (req: Request, res: Response) => {
    const { user } = req;
    if (!user) throw new UnauthorizedError('Unauthorized, no user provided');

    const userId = (req.params as unknown as { userId: number }).userId;
    const query = req.query as unknown as BookingListQueryInput;
    const { bookings, total } = await listUserBookings(
      { id: user.id, role: user.role },
      userId,
      query,
    );

    sendSuccess(res, {
      data: bookings.map(toBookingDTO),
      message: `Bookings for user ${userId} retrieved successfully`,
      meta: buildPaginationMeta(total, query.page, query.limit),
    });
  },
);
export const getUserBookings: RequestHandler[] = [
  ...zodValidation.params(bookingUserIdParam),
  ...zodValidation.query(bookingListQuery),
  handleGetUserBookings,
];

const handleGetAllBookings = asyncHandler(
  async (req: Request, res: Response) => {
    const { user } = req;
    if (!user) throw new UnauthorizedError('Unauthorized, no user provided');

    const query = req.query as unknown as BookingListQueryInput;
    const { bookings, total } = await listBookings(
      { id: user.id, role: user.role },
      query,
    );

    sendSuccess(res, {
      data: bookings.map(toBookingDTO),
      message: 'Bookings retrieved successfully',
      meta: buildPaginationMeta(total, query.page, query.limit),
    });
  },
);
export const getAllBookings: RequestHandler[] = [
  ...zodValidation.query(bookingListQuery),
  handleGetAllBookings,
];

const handleDeleteAllBookings = asyncHandler(
  async (req: Request, res: Response) => {
    const { user } = req;
    if (!user) throw new UnauthorizedError('Unauthorized access');

    const summary = await deleteAllBookingsService({
      id: user.id,
      role: user.role,
    });

    sendSuccess(res, {
      data: summary,
      message: `Successfully deleted ${summary.deletedCount} booking${summary.deletedCount > 1 ? 's' : ''}`,
    });
  },
);
export const deleteAllBookings: RequestHandler[] = [handleDeleteAllBookings];
