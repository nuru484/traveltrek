// src/controllers/authentication/register.ts
//
// Two thin bundles over the auth service's account creation; customers and
// staff are separate principals:
//
// - registerUser — the PUBLIC signup (POST /auth/register-user), MINIMAL:
//   name + (email OR phone), password optional (passwordless accounts sign in
//   via OTP/Google and complete their profile later). No authentication runs
//   before it and there is NO role concept: every public signup creates a
//   Customer, and a customer session is issued immediately.
// - adminCreateUser — POST /users (mounted by routes/user.ts, behind
//   authenticate-jwt + authorizeRole). Creates STAFF ONLY: only an ADMIN
//   actor may create users (agents pass the route gate but are refused
//   here), the role is required and zod-restricted to ADMIN | AGENT, and NO
//   session cookies are issued for the created account.
//   Admins never set passwords: the account starts PASSWORDLESS (zod strips
//   any sent value) and its owner establishes one via forgot-password.
//
// Both share the multer -> zod -> Cloudinary pipeline; if account creation
// fails after the middleware already uploaded a picture, that upload is
// reclaimed best-effort before rethrowing.
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
  customerPrincipal,
  mintAuthTokens,
  type RegisterInput,
  register as registerService,
} from '#services/auth.service.js';
import { UserRole } from '#types/user-profile.types.js';
import { CookieManager } from '#utils/CookieManager.js';
import { sendSuccess } from '#utils/http-response.js';
import logger from '#utils/logger.js';
import { toCustomerDTO } from '#utils/mappers/customer.mapper.js';
import { toUserDTO } from '#utils/mappers/user.mapper.js';
import {
  AdminCreateUserBody,
  adminCreateUserSchema,
  RegisterUserBody,
  registerUserSchema,
} from '#validations/auth-validation.js';

/** Bodies of both creation flows; admin's is stricter (and password-free —
 * only the public signup may carry one). */
type UserCreationBody = AdminCreateUserBody | RegisterUserBody;

const toRegisterInput = (
  body: UserCreationBody,
): Omit<RegisterInput, 'password'> => ({
  address: body.address,
  email: body.email,
  name: body.name,
  // Written by conditionalCloudinaryUpload when a file was uploaded.
  profilePicture: body.profilePicture,
  ...(body.phone !== undefined && { phone: body.phone }),
});

/** Runs the given creation; if it fails after the middleware already uploaded
 * a profile picture, reclaims that upload best-effort before rethrowing. */
const createReclaimingUpload = async <T>(
  body: UserCreationBody,
  create: () => Promise<T>,
): Promise<T> => {
  try {
    return await create();
  } catch (error) {
    if (body.profilePicture) {
      try {
        await cloudinaryService.deleteImage(body.profilePicture);
      } catch (cleanupError) {
        logger.error({ err: cleanupError }, 'Failed to clean up Cloudinary image');
      }
    }
    throw error;
  }
};

const handleRegisterUser = asyncHandler(
  async (req: Request, res: Response) => {
    const body = req.body as RegisterUserBody;

    // Public signup: always a Customer — no role exists on this surface.
    // The optional password is a PUBLIC-signup-only affordance.
    const customer = await createReclaimingUpload(body, () =>
      registerService({ ...toRegisterInput(body), password: body.password }),
    );
    const tokens = await mintAuthTokens(customerPrincipal(customer));

    CookieManager.setAuthTokens(res, tokens);
    sendSuccess(res, {
      data: toCustomerDTO(customer),
      message: 'Registration successful.',
      status: HTTP_STATUS_CODES.CREATED,
    });
  },
);

const handleAdminCreateUser = asyncHandler(
  async (req: Request, res: Response) => {
    // authorizeRole lets AGENT through to this route; staff creation is
    // ADMIN-only, so it is narrowed here with a 401.
    if (req.user?.role !== UserRole.ADMIN) {
      throw new UnauthorizedError('Unauthorized. Only admins can add users.');
    }

    const body = req.body as AdminCreateUserBody;
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

/** Shared multer -> zod -> Cloudinary pipeline; the schema differs (public
 * signup is minimal, admin creation is stricter). */
const creationPipeline = (schema: Parameters<typeof zodValidation.body>[0]) => [
  multerUpload.single('profilePicture'),
  ...zodValidation.body(schema),
  conditionalCloudinaryUpload(CLOUDINARY_UPLOAD_OPTIONS, 'profilePicture'),
];

export const registerUser: RequestHandler[] = [
  ...creationPipeline(registerUserSchema),
  handleRegisterUser,
];

export const adminCreateUser: RequestHandler[] = [
  ...creationPipeline(adminCreateUserSchema),
  handleAdminCreateUser,
];
