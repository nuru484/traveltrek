// src/controllers/authentication/register.ts
//
// Two thin bundles over the auth service's user creation:
//
// - registerUser — the PUBLIC signup (POST /auth/register-user). No
//   authentication runs before it, so it NEVER trusts a role from the body:
//   every public signup is a CUSTOMER, and a session is issued immediately.
// - adminCreateUser — POST /users (borrowed by routes/user.ts, behind
//   authenticate-jwt + authorizeRole). Only an ADMIN actor may create users
//   (agents pass the route gate but are refused here, as in the legacy
//   handler), the body's role is honoured, and NO session cookies are issued
//   for the created account.
//
// Both share the multer -> zod -> Cloudinary pipeline; if user creation fails
// after the middleware already uploaded a picture, that upload is reclaimed
// best-effort before rethrowing (legacy behaviour).
import { Request, RequestHandler, Response } from 'express';

import { cloudinaryService } from '#config/claudinary.js';
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
  adminCreateUser as adminCreateUserService,
  mintAuthTokens,
  type RegisteredUser,
  type RegisterInput,
  register as registerService,
} from '#services/auth.service.js';
import { UserRole } from '#types/user-profile.types.js';
import { CookieManager } from '#utils/CookieManager.js';
import { sendSuccess } from '#utils/http-response.js';
import logger from '#utils/logger.js';
import { toUserDTO } from '#utils/mappers/user.mapper.js';
import {
  RegisterUserBody,
  registerUserSchema,
} from '#validations/auth-validation.js';

const toRegisterInput = (body: RegisterUserBody): RegisterInput => ({
  address: body.address,
  email: body.email,
  name: body.name,
  password: body.password,
  // Written by conditionalCloudinaryUpload when a file was uploaded.
  profilePicture: body.profilePicture,
  ...(body.phone !== undefined && { phone: body.phone }),
});

/** Runs the given creation; if it fails after the middleware already uploaded
 * a profile picture, reclaims that upload best-effort before rethrowing. */
const createReclaimingUpload = async (
  body: RegisterUserBody,
  create: () => Promise<RegisteredUser>,
): Promise<RegisteredUser> => {
  try {
    return await create();
  } catch (error) {
    if (body.profilePicture) {
      try {
        await cloudinaryService.deleteImage(body.profilePicture);
      } catch (cleanupError) {
        logger.error('Failed to clean up Cloudinary image:', cleanupError);
      }
    }
    throw error;
  }
};

const handleRegisterUser = asyncHandler(
  async (req: Request, res: Response) => {
    const body = req.body as RegisterUserBody;

    // Public signup: the body's role is deliberately ignored.
    const user = await createReclaimingUpload(body, () =>
      registerService(toRegisterInput(body)),
    );
    const tokens = await mintAuthTokens(user);

    CookieManager.setAuthTokens(res, tokens);
    sendSuccess(res, {
      data: toUserDTO(user),
      message: 'Registration successful.',
      status: HTTP_STATUS_CODES.CREATED,
    });
  },
);

const handleAdminCreateUser = asyncHandler(
  async (req: Request, res: Response) => {
    // authorizeRole lets AGENT through to this route; the legacy handler
    // narrowed it to ADMIN with a 401 — preserved.
    if (req.user?.role !== UserRole.ADMIN) {
      throw new UnauthorizedError('Unauthorized. Only admins can add users.');
    }

    const body = req.body as RegisterUserBody;
    const user = await createReclaimingUpload(body, () =>
      adminCreateUserService(toRegisterInput(body), body.role),
    );

    sendSuccess(res, {
      data: toUserDTO(user),
      message: 'User created successfully.',
      status: HTTP_STATUS_CODES.CREATED,
    });
  },
);

const creationPipeline = [
  multerUpload.single('profilePicture'),
  ...zodValidation.body(registerUserSchema),
  conditionalCloudinaryUpload(CLOUDINARY_UPLOAD_OPTIONS, 'profilePicture'),
];

export const registerUser: RequestHandler[] = [
  ...creationPipeline,
  handleRegisterUser,
];

export const adminCreateUser: RequestHandler[] = [
  ...creationPipeline,
  handleAdminCreateUser,
];
