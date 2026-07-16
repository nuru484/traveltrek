import bcrypt from 'bcrypt';
// src/controllers/authentication/register.ts
import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import { cloudinaryService } from '#config/claudinary.js';
import { CLOUDINARY_UPLOAD_OPTIONS } from '#config/constants.js';
import { HTTP_STATUS_CODES } from '#config/constants.js';
import { BCRYPT_SALT_ROUNDS } from '#config/constants.js';
import { assertEnv } from '#config/env.js';
import ENV from '#config/env.js';
import multerUpload from '#config/multer.js';
import prisma from '#config/prismaClient.js';
import conditionalCloudinaryUpload from '#middlewares/conditional-cloudinary-upload.js';
import {
  BadRequestError,
  UnauthorizedError,
} from '#middlewares/error-handler.js';
import validationMiddleware from '#middlewares/validation.js';
import {
  IUserRegistrationInput,
  IUserResponseData,
  UserRole,
} from '#types/user-profile.types.js';
import { CookieManager } from '#utils/CookieManager.js';
import logger from '#utils/logger.js';
import { registerUserValidation } from '#validations/auth-validations.js';

/**
 * Controller function for user registration
 */
const handleRegisterUser = async (
  req: Request<{}, {}, IUserRegistrationInput>,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const userDetails = req.body;
  let uploadedImageUrl: string | undefined;

  try {
    let userRole: UserRole;
    let isAdminCreatingUser = false;

    if (req.user) {
      if (req.user.role !== UserRole.ADMIN) {
        throw new UnauthorizedError('Unauthorized. Only admins can add users.');
      }

      isAdminCreatingUser = true;
      userRole = userDetails.role ?? UserRole.CUSTOMER;
    } else {
      userRole = UserRole.CUSTOMER;
    }

    const hashedPassword = await bcrypt.hash(
      userDetails.password,
      BCRYPT_SALT_ROUNDS,
    );

    const profilePicture = req.body.profilePicture;
    if (profilePicture && typeof profilePicture !== 'string') {
      throw new BadRequestError(
        'Invalid profile picture format. Expected a string URL.',
      );
    }

    uploadedImageUrl = profilePicture;

    const userCreationData: IUserRegistrationInput = {
      ...userDetails,
      password: hashedPassword,
      profilePicture: profilePicture || undefined,
      role: userRole,
    };

    const user = await prisma.user.create({
      data: userCreationData,
    });

    const { password: _password, ...userWithoutPassword } = user;

    if (!isAdminCreatingUser) {
      const accessToken = jwt.sign(
        { id: user.id, role: user.role },
        assertEnv(ENV.ACCESS_TOKEN_SECRET, 'ACCESS_TOKEN_SECRET'),
        { expiresIn: '30m' },
      );

      const refreshToken = jwt.sign(
        { id: user.id, role: user.role },
        assertEnv(ENV.REFRESH_TOKEN_SECRET, 'REFRESH_TOKEN_SECRET'),
        {
          expiresIn: '7d',
        },
      );

      CookieManager.clearAllTokens(res);
      CookieManager.setAccessToken(res, accessToken);
      CookieManager.setRefreshToken(res, refreshToken);
    }

    res.status(HTTP_STATUS_CODES.CREATED).json({
      data: userWithoutPassword as IUserResponseData,
      message: isAdminCreatingUser
        ? 'User created successfully.'
        : 'Registration successful.',
    });
  } catch (error) {
    if (uploadedImageUrl) {
      try {
        await cloudinaryService.deleteImage(uploadedImageUrl);
      } catch (cleanupError) {
        logger.error('Failed to clean up Cloudinary image:', cleanupError);
      }
    }
    next(error);
  }
};

/**
 * Middleware array for user registration
 */
export const registerUser = [
  multerUpload.single('profilePicture'),
  validationMiddleware.create(registerUserValidation),
  conditionalCloudinaryUpload(CLOUDINARY_UPLOAD_OPTIONS, 'profilePicture'),
  handleRegisterUser,
] as const;
