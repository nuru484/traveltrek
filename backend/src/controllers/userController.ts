// src/controllers/userController.ts
import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import prisma from '../config/prismaClient';
import validationMiddleware from '../middlewares/validation';
import { updateUserProfileValidation } from '../validations/user-validations';
import { cloudinaryService } from '../config/claudinary';
import {
  asyncHandler,
  ValidationError,
  CustomError,
  BadRequestError,
  UnauthorizedError,
  NotFoundError,
  ForbiddenError,
} from '../middlewares/error-handler';
import {
  IUserResponseData,
  IUserUpdateInput,
  IUserUpdateData,
  UserRole,
  IUsersPaginatedResponse,
} from '../../types/user-profile.types';
import conditionalCloudinaryUpload from '../middlewares/conditional-cloudinary-upload';
import multerUpload from '../config/multer';
import { HTTP_STATUS_CODES, BCRYPT_SALT_ROUNDS } from '../config/constants';
import { CLOUDINARY_UPLOAD_OPTIONS } from '../config/constants';
import logger from '../utils/logger';

/**
 * Controller function for updating user profile
 */
const handleUpdateUserProfile = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { userId } = req.params;
    const currentUserId = req.user?.id;
    const currentUserRole = req.user?.role;
    const userDetails: IUserUpdateInput = req.body;

    if (!userId || isNaN(parseInt(userId))) {
      throw new BadRequestError('Valid user ID is required.');
    }

    const targetUserId = parseInt(userId);

    if (
      targetUserId !== parseInt(currentUserId?.toString() || '0') &&
      currentUserRole !== UserRole.ADMIN &&
      currentUserRole !== UserRole.AGENT
    ) {
      throw new UnauthorizedError(
        'You are not authorized to update this user.',
      );
    }

    let uploadedImageUrl: string | undefined;
    let oldProfilePicture: string | null = null;

    try {
      const existingUser = await prisma.user.findUnique({
        where: { id: targetUserId },
        select: { profilePicture: true, email: true, phone: true },
      });

      if (!existingUser) {
        throw new CustomError(HTTP_STATUS_CODES.NOT_FOUND, 'User not found.');
      }

      oldProfilePicture = existingUser.profilePicture;

      if (userDetails.email && userDetails.email !== existingUser.email) {
        const existingUserByEmail = await prisma.user.findUnique({
          where: { email: userDetails.email },
        });

        if (existingUserByEmail && existingUserByEmail.id !== targetUserId) {
          throw new CustomError(
            HTTP_STATUS_CODES.CONFLICT,
            'A user with this email already exists.',
          );
        }
      }

      if (userDetails.phone && userDetails.phone !== existingUser.phone) {
        const existingUserByPhone = await prisma.user.findUnique({
          where: { phone: userDetails.phone },
        });

        if (existingUserByPhone && existingUserByPhone.id !== targetUserId) {
          throw new CustomError(
            HTTP_STATUS_CODES.CONFLICT,
            'A user with this phone number already exists.',
          );
        }
      }

      const updateData: IUserUpdateData = {};

      if (userDetails.name !== undefined) updateData.name = userDetails.name;
      if (userDetails.email !== undefined) updateData.email = userDetails.email;
      if (userDetails.phone !== undefined) updateData.phone = userDetails.phone;
      if (userDetails.address !== undefined)
        updateData.address = userDetails.address;

      if (userDetails.password) {
        updateData.password = await bcrypt.hash(
          userDetails.password,
          BCRYPT_SALT_ROUNDS,
        );
      }

      if (
        req.body.profilePicture &&
        typeof req.body.profilePicture === 'string'
      ) {
        updateData.profilePicture = req.body.profilePicture;
        uploadedImageUrl = req.body.profilePicture;
      }

      const updatedUser = await prisma.user.update({
        where: { id: targetUserId },
        data: updateData,
      });

      if (
        uploadedImageUrl &&
        oldProfilePicture &&
        oldProfilePicture !== uploadedImageUrl
      ) {
        try {
          await cloudinaryService.deleteImage(oldProfilePicture);
        } catch (cleanupError) {
          logger.warn('Failed to clean up old profile picture:', cleanupError);
        }
      }

      const { password, ...userWithoutPassword } = updatedUser;

      res.status(HTTP_STATUS_CODES.OK).json({
        message: 'Profile updated successfully.',
        data: userWithoutPassword as IUserResponseData,
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
  },
);

/**
 * Middleware array for user profile update
 */

export const updateUserProfile = [
  multerUpload.single('profilePicture'),
  validationMiddleware.create(updateUserProfileValidation),
  conditionalCloudinaryUpload(CLOUDINARY_UPLOAD_OPTIONS, 'profilePicture'),
  handleUpdateUserProfile,
] as const;

/**
 * Get single user by ID
 */
export const getUserById = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { userId } = req.params;
    const currentUserId = req.user?.id;
    const currentUserRole = req.user?.role;

    // Validate input
    if (!userId || isNaN(parseInt(userId))) {
      throw new ValidationError('Valid user ID is required');
    }

    const targetUserId = parseInt(userId);

    if (
      targetUserId !== parseInt(currentUserId?.toString() || '0') &&
      currentUserRole !== UserRole.ADMIN &&
      currentUserRole !== UserRole.AGENT
    ) {
      throw new UnauthorizedError(
        'You are not authorized to view this user profile',
      );
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        address: true,
        profilePicture: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    const response: IUserResponseData = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role as UserRole,
      phone: user.phone ?? undefined,
      address: user.address ?? undefined,
      profilePicture: user.profilePicture ?? undefined,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    res.status(HTTP_STATUS_CODES.OK).json({
      message: 'User retrieved successfully',
      data: response,
    });
  },
);

/**
 * Get all users with pagination
 */
export const getAllUsers = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const role = req.query.role as UserRole | undefined;
    const search = req.query.search as string | undefined;

    const whereClause: any = {};

    if (role && Object.values(UserRole).includes(role)) {
      whereClause.role = role;
    }

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          phone: true,
          address: true,
          profilePicture: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.user.count({ where: whereClause }),
    ]);

    const response: IUserResponseData[] = users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role as UserRole,
      phone: user.phone ?? undefined,
      address: user.address ?? undefined,
      profilePicture: user.profilePicture ?? undefined,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }));

    const paginatedResponse: IUsersPaginatedResponse = {
      message: 'Users retrieved successfully',
      data: response,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };

    res.status(HTTP_STATUS_CODES.OK).json(paginatedResponse);
  },
);

/**
 * Change user role - Admin only
 */
export const changeUserRole = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { userId } = req.params;
    const { role } = req.body;
    const currentUserId = req.user?.id;

    if (!userId || isNaN(parseInt(userId))) {
      throw new ValidationError('Valid user ID is required');
    }

    if (!role || !Object.values(UserRole).includes(role)) {
      throw new ValidationError('Valid role is required');
    }

    if (parseInt(userId) === parseInt(currentUserId?.toString() || '0')) {
      throw new ForbiddenError('You cannot change your own role');
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: parseInt(userId) },
      select: { id: true, name: true, email: true, role: true },
    });

    if (!existingUser) {
      throw new NotFoundError('User not found');
    }

    if (existingUser.role === role) {
      throw new BadRequestError(`User already has the role: ${role}`);
    }

    const updatedUser = await prisma.user.update({
      where: { id: parseInt(userId) },
      data: { role },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        address: true,
        profilePicture: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const response: IUserResponseData = {
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role as UserRole,
      phone: updatedUser.phone ?? undefined,
      address: updatedUser.address ?? undefined,
      profilePicture: updatedUser.profilePicture ?? undefined,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt,
    };

    res.status(HTTP_STATUS_CODES.OK).json({
      message: `User role updated successfully to ${role}`,
      data: response,
    });
  },
);

/**
 * Delete a single user - Admin only
 */
export const deleteUser = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { userId } = req.params;
    const currentUserId = req.user?.id;
    const currentUserRole = req.user?.role;

    if (!userId || isNaN(parseInt(userId))) {
      throw new ValidationError('Valid user ID is required');
    }

    const targetUserId = parseInt(userId);

    if (targetUserId === parseInt(currentUserId?.toString() || '0')) {
      if (currentUserRole === UserRole.ADMIN) {
        throw new ForbiddenError('Admins cannot delete themselves');
      }
    } else {
      if (currentUserRole !== UserRole.ADMIN) {
        throw new UnauthorizedError(
          'You are not authorized to delete other users',
        );
      }
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        profilePicture: true,
      },
    });

    if (!existingUser) {
      throw new NotFoundError('User not found');
    }

    const activePayments = await prisma.payment.count({
      where: {
        userId: targetUserId,
        status: {
          not: 'REFUNDED',
        },
      },
    });

    if (activePayments > 0) {
      throw new CustomError(
        HTTP_STATUS_CODES.CONFLICT,
        'Cannot delete user with active (non-refunded) payments. ' +
          'Please handle or refund payments first.',
      );
    }

    await prisma.user.delete({
      where: { id: targetUserId },
    });

    if (existingUser.profilePicture) {
      try {
        await cloudinaryService.deleteImage(existingUser.profilePicture);
      } catch (cleanupError) {
        logger.warn(
          `Failed to clean up profile picture for deleted user ${userId}:`,
          cleanupError,
        );
      }
    }

    res.status(HTTP_STATUS_CODES.OK).json({
      message: `User "${existingUser.name}" (${existingUser.email}) deleted successfully`,
    });
  },
);

/**
 * Delete all users - Super Admin only (dangerous operation)
 */
export const deleteAllUsers = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const currentUserId = req.user?.id;
    const confirmDelete = req.body.confirmDelete;

    if (confirmDelete !== 'DELETE_ALL_USERS') {
      throw new BadRequestError(
        'This operation requires confirmation. Send { "confirmDelete": "DELETE_ALL_USERS" } in request body.',
      );
    }

    const usersToDelete = await prisma.user.findMany({
      where: {
        id: { not: parseInt(currentUserId?.toString() || '0') },
      },
      select: {
        id: true,
        name: true,
        email: true,
        profilePicture: true,
      },
    });

    if (usersToDelete.length === 0) {
      res.status(HTTP_STATUS_CODES.OK).json({
        message: 'No users to delete',
        deletedCount: 0,
      });
      return;
    }

    const usersWithActivePayments = await prisma.payment.findMany({
      where: {
        userId: {
          in: usersToDelete.map((u) => u.id),
        },
        status: {
          not: 'REFUNDED',
        },
      },
      select: { userId: true },
    });

    const blockedUserIds = new Set(
      usersWithActivePayments.map((p) => p.userId),
    );

    if (blockedUserIds.size > 0) {
      throw new CustomError(
        HTTP_STATUS_CODES.CONFLICT,
        `Cannot delete ${blockedUserIds.size} users with active (non-refunded) payments. ` +
          'Please handle or refund payments first.',
      );
    }

    const profilePicturesToDelete = usersToDelete
      .filter((user) => user.profilePicture)
      .map((user) => user.profilePicture!);

    const deleteResult = await prisma.user.deleteMany({
      where: {
        id: { not: parseInt(currentUserId?.toString() || '0') },
      },
    });

    if (profilePicturesToDelete.length > 0) {
      const cleanupPromises = profilePicturesToDelete.map(
        async (profilePicture) => {
          try {
            await cloudinaryService.deleteImage(profilePicture);
          } catch (error) {
            logger.warn(
              `Failed to clean up profile picture: ${profilePicture}`,
              error,
            );
          }
        },
      );

      Promise.allSettled(cleanupPromises).then((results) => {
        const failed = results.filter(
          (result) => result.status === 'rejected',
        ).length;
        if (failed > 0) {
          logger.warn(
            `Failed to clean up ${failed} profile pictures from Cloudinary`,
          );
        }
      });
    }

    res.status(HTTP_STATUS_CODES.OK).json({
      message: `Successfully deleted ${deleteResult.count} users`,
      deletedCount: deleteResult.count,
    });
  },
);
