// src/services/user.service.ts
//
// STAFF management domain logic (Phase 5b: customers moved to their own
// Customer model/service — every User row is an ADMIN or AGENT). Pure, DI'd
// functions: they take typed inputs, own every Prisma access and domain
// invariant (email/phone uniqueness, password re-hashing, role-change and
// delete guards, Cloudinary picture cleanup), throw the typed CustomError
// subclasses and never touch req/res.
//
// Authorization note: routes/user.ts now gates every endpoint to staff; the
// per-record rules stay here as explicit actor checks — staff may view/update
// their own profile, ADMIN/AGENT may touch anyone, admins may not change
// their own role or delete themselves, and only admins may delete other
// users. The legacy payment-based delete guards are GONE: staff users have no
// bookings/payments relations anymore (those hang off Customer).
//
// Cleanup note: every Cloudinary delete is best-effort via the injected
// cloudinary dep — a cleanup failure never fails the request. deleteAllUsers
// keeps the legacy fire-and-forget semantics (the response never waits on
// image deletion); the legacy `.then` that counted rejected settlements was
// dead code (each cleanup catches internally), so it was dropped.
import bcrypt from 'bcrypt';

import { BCRYPT_SALT_ROUNDS, HTTP_STATUS_CODES } from '#config/constants.js';
import { type Prisma, type Role } from '#config/prismaClient.js';
import {
  BadRequestError,
  CustomError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from '#middlewares/error-handler.js';
import { type AppDeps, defaultDeps } from '#services/deps.js';
import { type IUser, UserRole } from '#types/user-profile.types.js';
import { invalidateCachedTokenVersion } from '#utils/authz-cache.js';
import { assertContactFreeAcrossPrincipals } from '#utils/cross-principal-contact.js';
import { type SafeUser, userSelect } from '#utils/mappers/user.mapper.js';

export type UserActor = Pick<IUser, 'id' | 'role'>;

export interface UserDeleteSummary {
  /** Null for phone-only accounts (email is a nullable column). */
  email: null | string;
  name: string;
}

export interface UserListParams {
  limit: number;
  page: number;
  role?: Role;
  search?: string;
}

export interface UsersBulkDeleteSummary {
  deletedCount: number;
}

export interface UserUpdateInput {
  address?: string;
  email?: string;
  name?: string;
  /** Re-hashed with BCRYPT_SALT_ROUNDS before it touches the database. */
  password?: string;
  phone?: string;
  /** Cloudinary URL, already uploaded by the route's middleware. */
  profilePicture?: string;
}

/** May the actor read/write this profile? Self always; ADMIN/AGENT anyone. */
const canTouchProfile = (actor: UserActor, userId: number): boolean =>
  userId === actor.id ||
  actor.role === UserRole.ADMIN ||
  actor.role === UserRole.AGENT;

export const makeUserService = (
  d: Pick<AppDeps, 'clock' | 'cloudinary' | 'logger' | 'prisma'>,
) => {
  const { clock, cloudinary, logger, prisma } = d;

  /** Best-effort Cloudinary delete; a cleanup failure never fails the request. */
  const cleanupPicture = async (
    picture: string,
    context: string,
  ): Promise<void> => {
    try {
      await cloudinary.deleteImage(picture);
    } catch (cleanupError) {
      logger.warn({ err: cleanupError, picture }, context);
    }
  };

  /** GET /users/:userId — customers may only view their own profile. */
  const getUserById = async (
    actor: UserActor,
    userId: number,
  ): Promise<SafeUser> => {
    if (!canTouchProfile(actor, userId)) {
      throw new UnauthorizedError(
        'You are not authorized to view this user profile',
      );
    }

    // findFirst so soft-deleted users 404 like hard-deleted ones did.
    const user = await prisma.user.findFirst({
      select: userSelect,
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    return user;
  };

  /** GET /users — newest first, optional role filter and name/email/phone search. */
  const listUsers = async (
    params: UserListParams,
  ): Promise<{ total: number; users: SafeUser[] }> => {
    const where: Prisma.UserWhereInput = {};

    if (params.role) {
      where.role = params.role;
    }

    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { email: { contains: params.search, mode: 'insensitive' } },
        { phone: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        select: userSelect,
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        where,
      }),
      prisma.user.count({ where }),
    ]);

    return { total, users };
  };

  /**
   * PUT /users/:userId — self or ADMIN/AGENT only. Guard order is the legacy
   * one: actor rule → existence → email uniqueness → phone uniqueness →
   * update. A replaced profile picture has its old image cleaned up
   * best-effort; if anything fails after the middleware already uploaded a
   * new image, that fresh upload is cleaned up before rethrowing (the legacy
   * catch block, which logged this path at error level).
   */
  const updateUserProfile = async (
    actor: UserActor,
    userId: number,
    input: UserUpdateInput,
  ): Promise<SafeUser> => {
    if (!canTouchProfile(actor, userId)) {
      throw new UnauthorizedError(
        'You are not authorized to update this user.',
      );
    }

    const uploadedImageUrl = input.profilePicture;

    try {
      const existingUser = await prisma.user.findFirst({
        select: { email: true, phone: true, profilePicture: true },
        where: { id: userId },
      });

      if (!existingUser) {
        throw new CustomError(HTTP_STATUS_CODES.NOT_FOUND, 'User not found.');
      }

      // Uniqueness pre-checks use findUnique ON PURPOSE (unscoped): the DB
      // unique constraints span soft-deleted rows (khadys convention), so a
      // tombstoned user still holds its email/phone and the pre-check must
      // see it — otherwise the update would die on a raw P2002 instead.
      if (input.email && input.email !== existingUser.email) {
        const userByEmail = await prisma.user.findUnique({
          where: { email: input.email },
        });

        if (userByEmail && userByEmail.id !== userId) {
          throw new CustomError(
            HTTP_STATUS_CODES.CONFLICT,
            'A user with this email already exists.',
          );
        }
      }

      if (input.phone && input.phone !== existingUser.phone) {
        const userByPhone = await prisma.user.findUnique({
          where: { phone: input.phone },
        });

        if (userByPhone && userByPhone.id !== userId) {
          throw new CustomError(
            HTTP_STATUS_CODES.CONFLICT,
            'A user with this phone number already exists.',
          );
        }
      }

      // Cross-table guard: staff must not claim a customer's contact (and
      // vice versa) — login precedence makes collisions dangerous.
      await assertContactFreeAcrossPrincipals(
        prisma,
        {
          email: input.email !== existingUser.email ? input.email : undefined,
          phone: input.phone !== existingUser.phone ? input.phone : undefined,
        },
        'staff',
      );

      // Prisma ignores undefined keys, so omitted fields stay untouched. An
      // empty password string is skipped, like the legacy falsy check.
      const updatedUser = await prisma.user.update({
        data: {
          address: input.address,
          email: input.email,
          name: input.name,
          password: input.password
            ? await bcrypt.hash(input.password, BCRYPT_SALT_ROUNDS)
            : undefined,
          phone: input.phone,
          profilePicture: uploadedImageUrl,
        },
        select: userSelect,
        where: { id: userId },
      });

      // Replaced picture: drop the old image now that the row points elsewhere.
      if (
        uploadedImageUrl &&
        existingUser.profilePicture &&
        existingUser.profilePicture !== uploadedImageUrl
      ) {
        await cleanupPicture(
          existingUser.profilePicture,
          'Failed to clean up old profile picture',
        );
      }

      return updatedUser;
    } catch (error) {
      // The picture was already uploaded by the route middleware; don't
      // orphan it on Cloudinary when the update is refused.
      if (uploadedImageUrl) {
        try {
          await cloudinary.deleteImage(uploadedImageUrl);
        } catch (cleanupError) {
          logger.error(
            { err: cleanupError, picture: uploadedImageUrl },
            'Failed to clean up Cloudinary image',
          );
        }
      }
      throw error;
    }
  };

  /**
   * PATCH /users/:userId/role — admins may not change their own role, and a
   * no-op change is refused (same guard order as the legacy handler; the
   * role whitelist itself moved to the zod schema).
   */
  const changeUserRole = async (
    actor: UserActor,
    userId: number,
    role: Role,
  ): Promise<SafeUser> => {
    if (userId === actor.id) {
      throw new ForbiddenError('You cannot change your own role');
    }

    const existingUser = await prisma.user.findFirst({
      select: { role: true },
      where: { id: userId },
    });

    if (!existingUser) {
      throw new NotFoundError('User not found');
    }

    if (existingUser.role === role) {
      throw new BadRequestError(`User already has the role: ${role}`);
    }

    const updated = await prisma.user.update({
      data: { role },
      select: userSelect,
      where: { id: userId },
    });

    // Drop the cached session epoch so the next authenticated request
    // re-reads the user's live row rather than a pre-change cache entry.
    invalidateCachedTokenVersion('staff', userId);

    return updated;
  };

  /**
   * DELETE /users/:userId — admins may not delete themselves; only admins
   * may delete others (a non-admin self-delete fell through in the legacy
   * handler — unreachable anyway, routes gate this endpoint to ADMIN). Staff
   * users carry no bookings/payments (those belong to Customers), so the
   * legacy payment guard is gone. The profile picture is cleaned up
   * best-effort after the row is gone.
   */
  const deleteUser = async (
    actor: UserActor,
    userId: number,
  ): Promise<UserDeleteSummary> => {
    if (userId === actor.id) {
      if (actor.role === UserRole.ADMIN) {
        throw new ForbiddenError('Admins cannot delete themselves');
      }
    } else if (actor.role !== UserRole.ADMIN) {
      throw new UnauthorizedError(
        'You are not authorized to delete other users',
      );
    }

    const existingUser = await prisma.user.findFirst({
      select: {
        email: true,
        id: true,
        name: true,
        profilePicture: true,
        role: true,
      },
      where: { id: userId },
    });

    if (!existingUser) {
      throw new NotFoundError('User not found');
    }

    // Soft delete: the row survives (deletedAt set); scoped reads hide it.
    await prisma.user.update({
      data: { deletedAt: clock.now() },
      where: { id: userId },
    });

    // Deleted accounts must lose access at once, not at cache expiry: the
    // next request re-reads the DB (scoped), finds no row, and is rejected.
    invalidateCachedTokenVersion('staff', userId);

    if (existingUser.profilePicture) {
      await cleanupPicture(
        existingUser.profilePicture,
        `Failed to clean up profile picture for deleted user ${String(userId)}`,
      );
    }

    return { email: existingUser.email, name: existingUser.name };
  };

  /**
   * DELETE /users — wipes every staff user EXCEPT the acting admin. Requires
   * the legacy confirmation phrase (kept here, not in zod, so the exact
   * message and error shape survive) and reports zero deletions as a success.
   * The legacy payment guard is gone — staff carry no payments (Customers
   * do). Picture cleanup is fire-and-forget, as before.
   */
  const deleteAllUsers = async (
    actor: UserActor,
    confirmDelete: unknown,
  ): Promise<UsersBulkDeleteSummary> => {
    if (confirmDelete !== 'DELETE_ALL_USERS') {
      throw new BadRequestError(
        'This operation requires confirmation. Send { "confirmDelete": "DELETE_ALL_USERS" } in request body.',
      );
    }

    const usersToDelete = await prisma.user.findMany({
      select: {
        email: true,
        id: true,
        name: true,
        profilePicture: true,
      },
      where: {
        id: { not: actor.id },
      },
    });

    if (usersToDelete.length === 0) {
      return { deletedCount: 0 };
    }

    const profilePicturesToDelete = usersToDelete.flatMap((user) =>
      user.profilePicture ? [user.profilePicture] : [],
    );

    const deleteResult = await prisma.user.updateMany({
      data: { deletedAt: clock.now() },
      where: {
        deletedAt: null,
        id: { not: actor.id },
      },
    });

    // Fire-and-forget: the response never waits on Cloudinary cleanup.
    if (profilePicturesToDelete.length > 0) {
      void Promise.allSettled(
        profilePicturesToDelete.map((profilePicture) =>
          cleanupPicture(
            profilePicture,
            `Failed to clean up profile picture: ${profilePicture}`,
          ),
        ),
      );
    }

    return { deletedCount: deleteResult.count };
  };

  return {
    changeUserRole,
    deleteAllUsers,
    deleteUser,
    getUserById,
    listUsers,
    updateUserProfile,
  };
};

export const userService = makeUserService(defaultDeps);

export const {
  changeUserRole,
  deleteAllUsers,
  deleteUser,
  getUserById,
  listUsers,
  updateUserProfile,
} = userService;
