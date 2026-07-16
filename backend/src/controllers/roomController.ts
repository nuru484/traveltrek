// src/controllers/roomController.ts
//
// Thin HTTP adapters for the room domain: each export is a RequestHandler
// bundle of [multer/photo middleware where relevant, zod validation
// middleware, asyncHandler(handler)]. Handlers read the typed
// req.query/body/params the middleware wrote back, call the room service,
// and reply through the standard envelope helpers. All domain logic
// (availability math included) lives in services/room.service.ts; role gates
// live in routes/room.ts (authorizeRole), so no handler re-checks
// req.user.role.
import { Request, RequestHandler, Response } from 'express';

import {
  CLOUDINARY_UPLOAD_OPTIONS,
  HTTP_STATUS_CODES,
} from '#config/constants.js';
import multerUpload from '#config/multer.js';
import conditionalCloudinaryUpload from '#middlewares/conditional-cloudinary-upload.js';
import { asyncHandler, ValidationError } from '#middlewares/error-handler.js';
import zodValidation from '#middlewares/validate-request.js';
import {
  checkAvailability,
  createRoom as createRoomService,
  deleteAllRooms as deleteAllRoomsService,
  deleteRoom as deleteRoomService,
  getRoomById,
  listRooms,
  updateRoom as updateRoomService,
} from '#services/room.service.js';
import { sendPaginated, sendSuccess } from '#utils/http-response.js';
import { toRoomDTO } from '#utils/mappers/room.mapper.js';
import { intParam } from '#validations/common-validation.js';
import {
  CreateRoomBody,
  createRoomSchema,
  RoomAvailabilityQuery,
  roomAvailabilityQuery,
  RoomListQuery,
  roomListQuery,
  UpdateRoomBody,
  updateRoomSchema,
} from '#validations/room-validation.js';

const ALLOWED_PHOTO_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
];
const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

/**
 * Guards the multer-parsed photo file (type + size) before the Cloudinary
 * upload middleware runs. Zod validates req.body only, so this mirrors the
 * photo-file checks of the other photo domains — same messages, same
 * validation-error envelope.
 */
const validatePhotoFile: RequestHandler = (req, _res, next) => {
  const { file } = req;
  if (!file) {
    next();
    return;
  }

  const errors: { field: string; message: string }[] = [];
  if (!ALLOWED_PHOTO_MIME_TYPES.includes(file.mimetype)) {
    errors.push({
      field: 'roomPhoto',
      message: 'Photo must be a valid image file (JPEG, PNG, or WebP)',
    });
  }
  if (file.size > MAX_PHOTO_SIZE_BYTES) {
    errors.push({
      field: 'roomPhoto',
      message: 'Photo size must not exceed 5MB',
    });
  }

  if (errors.length > 0) {
    next(
      new ValidationError('Validation Error', {
        code: 'VALIDATION_ERROR',
        context: { errors },
        layer: 'Request Validation',
      }),
    );
    return;
  }
  next();
};

/** Reads the room id that `intParam('id')` validated and coerced. */
const roomIdParam = (req: Request): number =>
  (req.params as unknown as { id: number }).id;

const handleCreateRoom = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as CreateRoomBody;
  const { availability, room } = await createRoomService({
    amenities: body.amenities,
    capacity: body.capacity,
    description: body.description,
    hotelId: body.hotelId,
    photo: body.roomPhoto,
    pricePerNight: body.pricePerNight,
    roomType: body.roomType,
    totalRooms: body.totalRooms,
  });
  sendSuccess(res, {
    data: toRoomDTO(room, availability),
    message: 'Room created successfully',
    status: HTTP_STATUS_CODES.CREATED,
  });
});
export const createRoom: RequestHandler[] = [
  multerUpload.single('roomPhoto'),
  validatePhotoFile,
  ...zodValidation.body(createRoomSchema),
  conditionalCloudinaryUpload(CLOUDINARY_UPLOAD_OPTIONS, 'roomPhoto'),
  handleCreateRoom,
];

const handleGetRoom = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as RoomAvailabilityQuery;
  const { availability, room } = await getRoomById(roomIdParam(req), query);
  sendSuccess(res, {
    data: toRoomDTO(room, availability),
    message: 'Room retrieved successfully',
  });
});
export const getRoom: RequestHandler[] = [
  ...zodValidation.params(intParam('id')),
  ...zodValidation.query(roomAvailabilityQuery),
  handleGetRoom,
];

const handleUpdateRoom = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as UpdateRoomBody;
  const { availability, room } = await updateRoomService(roomIdParam(req), {
    amenities: body.amenities,
    capacity: body.capacity,
    description: body.description,
    hotelId: body.hotelId,
    photo: body.roomPhoto,
    pricePerNight: body.pricePerNight,
    roomType: body.roomType,
    totalRooms: body.totalRooms,
  });
  sendSuccess(res, {
    data: toRoomDTO(room, availability),
    message: 'Room updated successfully',
  });
});
export const updateRoom: RequestHandler[] = [
  multerUpload.single('roomPhoto'),
  ...zodValidation.params(intParam('id')),
  validatePhotoFile,
  ...zodValidation.body(updateRoomSchema),
  conditionalCloudinaryUpload(CLOUDINARY_UPLOAD_OPTIONS, 'roomPhoto'),
  handleUpdateRoom,
];

const handleGetAllRooms = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as RoomListQuery;
  const { rooms, total } = await listRooms(query);
  sendPaginated(res, {
    data: rooms.map(({ availability, room }) => toRoomDTO(room, availability)),
    limit: query.limit,
    message: 'Rooms retrieved successfully',
    page: query.page,
    total,
  });
});
export const getAllRooms: RequestHandler[] = [
  ...zodValidation.query(roomListQuery),
  handleGetAllRooms,
];

const handleCheckRoomAvailability = asyncHandler(
  async (req: Request, res: Response) => {
    const query = req.query as unknown as RoomAvailabilityQuery;
    const report = await checkAvailability(roomIdParam(req), query);
    sendSuccess(res, {
      data: report,
      message: 'Room availability checked successfully',
    });
  },
);
export const checkRoomAvailability: RequestHandler[] = [
  ...zodValidation.params(intParam('id')),
  ...zodValidation.query(roomAvailabilityQuery),
  handleCheckRoomAvailability,
];

const handleDeleteRoom = asyncHandler(async (req: Request, res: Response) => {
  const summary = await deleteRoomService(roomIdParam(req));
  sendSuccess(res, {
    data: summary,
    message: 'Room deleted successfully',
  });
});
export const deleteRoom: RequestHandler[] = [
  ...zodValidation.params(intParam('id')),
  handleDeleteRoom,
];

// routes/room.ts already gates this route with authorizeRole([ADMIN]); the
// legacy handler never re-checked req.user.role, so nothing was dropped here.
const handleDeleteAllRooms = asyncHandler(
  async (_req: Request, res: Response) => {
    const summary = await deleteAllRoomsService();
    sendSuccess(res, {
      data: summary,
      message: `Successfully deleted ${summary.deleted} room(s)`,
    });
  },
);
export const deleteAllRooms: RequestHandler[] = [handleDeleteAllRooms];
