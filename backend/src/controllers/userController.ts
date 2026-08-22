// src/controllers/userController.ts
//
// Thin HTTP adapters for the user domain: each export is a RequestHandler
// bundle of [multer/picture middleware where relevant, zod validation
// middleware, asyncHandler(handler)]. Handlers read the typed
// req.query/body/params the middleware wrote back, call the user service,
// and reply through the standard envelope helpers. All domain logic
// (uniqueness checks, role-change and delete guards,
// Cloudinary cleanup) lives in services/user.service.ts.
//
// Like payments, the self-vs-others profile rules are NOT duplicated by
// routes/user.ts (authorizeRole only gates the broad role sets): they live in
// the service as actor-based rules, so each handler passes `{ id, role }`
// down. The `!user` guards below only narrow the optional type
// (authenticate-jwt always sets req.user) and fail closed.
//
// POST /users (registerUser) belongs to the authentication controllers and is
// mounted by routes/user.ts.
import { Request, RequestHandler, Response } from 'express';

import { CLOUDINARY_UPLOAD_OPTIONS } from '#config/constants.js';
import multerUpload from '#config/multer.js';
import conditionalCloudinaryUpload from '#middlewares/conditional-cloudinary-upload.js';
import {
  asyncHandler,
  UnauthorizedError,
} from '#middlewares/error-handler.js';
import zodValidation from '#middlewares/validate-request.js';
import {
  changeUserRole as changeUserRoleService,
  deleteUser as deleteUserService,
  getUserById as getUserByIdService,
  listUsers,
  updateUserProfile as updateUserProfileService,
} from '#services/user.service.js';
import { sendPaginated, sendSuccess } from '#utils/http-response.js';
import { toUserDTO } from '#utils/mappers/user.mapper.js';
import { intParam } from '#validations/common-validation.js';
import {
  ChangeUserRoleBody,
  changeUserRoleSchema,
  UpdateUserProfileBody,
  updateUserProfileSchema,
  userListQuery,
  UserListQueryInput,
} from '#validations/user-validation.js';

/** Reads the user id that `intParam('userId')` validated and coerced. */
const userIdParam = (req: Request): number =>
  (req.params as unknown as { userId: number }).userId;

const handleUpdateUserProfile = asyncHandler(
  async (req: Request, res: Response) => {
    // Read after conditionalCloudinaryUpload ran: an uploaded file's
    // Cloudinary URL has been written onto the parsed body's profilePicture.
    const body = req.body as UpdateUserProfileBody;
    const { user } = req;
    if (!user) {
      throw new UnauthorizedError(
        'You are not authorized to update this user.',
      );
    }

    const updatedUser = await updateUserProfileService(
      { id: user.id, role: user.role },
      userIdParam(req),
      {
        address: body.address,
        email: body.email,
        name: body.name,
        phone: body.phone,
        profilePicture: body.profilePicture,
      },
    );

    sendSuccess(res, {
      data: toUserDTO(updatedUser),
      message: 'Profile updated successfully.',
    });
  },
);
export const updateUserProfile: RequestHandler[] = [
  multerUpload.single('profilePicture'),
  ...zodValidation.params(intParam('userId')),
  ...zodValidation.body(updateUserProfileSchema),
  conditionalCloudinaryUpload(CLOUDINARY_UPLOAD_OPTIONS, 'profilePicture'),
  handleUpdateUserProfile,
];

const handleGetUserById = asyncHandler(
  async (req: Request, res: Response) => {
    const { user } = req;
    if (!user) {
      throw new UnauthorizedError(
        'You are not authorized to view this user profile',
      );
    }

    const foundUser = await getUserByIdService(
      { id: user.id, role: user.role },
      userIdParam(req),
    );

    sendSuccess(res, {
      data: toUserDTO(foundUser),
      message: 'User retrieved successfully',
    });
  },
);
export const getUserById: RequestHandler[] = [
  ...zodValidation.params(intParam('userId')),
  handleGetUserById,
];

const handleGetAllUsers = asyncHandler(
  async (req: Request, res: Response) => {
    const query = req.query as unknown as UserListQueryInput;
    const { total, users } = await listUsers(query);

    sendPaginated(res, {
      data: users.map(toUserDTO),
      limit: query.limit,
      message: 'Users retrieved successfully',
      page: query.page,
      total,
    });
  },
);
export const getAllUsers: RequestHandler[] = [
  ...zodValidation.query(userListQuery),
  handleGetAllUsers,
];

const handleChangeUserRole = asyncHandler(
  async (req: Request, res: Response) => {
    const { role } = req.body as ChangeUserRoleBody;
    const { user } = req;
    if (!user) throw new UnauthorizedError('Unauthorized access');

    const updatedUser = await changeUserRoleService(
      { id: user.id, role: user.role },
      userIdParam(req),
      role,
    );

    sendSuccess(res, {
      data: toUserDTO(updatedUser),
      message: `User role updated successfully to ${role}`,
    });
  },
);
export const changeUserRole: RequestHandler[] = [
  ...zodValidation.params(intParam('userId')),
  ...zodValidation.body(changeUserRoleSchema),
  handleChangeUserRole,
];

const handleDeleteUser = asyncHandler(
  async (req: Request, res: Response) => {
    const { user } = req;
    if (!user) {
      throw new UnauthorizedError(
        'You are not authorized to delete other users',
      );
    }

    const deleted = await deleteUserService(
      { id: user.id, role: user.role },
      userIdParam(req),
    );

    sendSuccess(res, {
      message: `User "${deleted.name}" (${deleted.email ?? 'no email'}) deleted successfully`,
    });
  },
);
export const deleteUser: RequestHandler[] = [
  ...zodValidation.params(intParam('userId')),
  handleDeleteUser,
];
