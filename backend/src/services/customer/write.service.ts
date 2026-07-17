// src/services/customer/write.service.ts
//
// Customer writes: staff-side creation (always passwordless), profile update
// (self or staff; login identifiers stay behind the verified auth flows for a
// self edit), and admin delete (active-booking guard, soft delete, picture
// cleanup). Contact-uniqueness and picture cleanup run through the core.
import { HTTP_STATUS_CODES } from '#config/constants.js';
import { BookingStatus } from '#config/prismaClient.js';
import {
  BadRequestError,
  CustomError,
  NotFoundError,
  UnauthorizedError,
} from '#middlewares/error-handler.js';
import { type CustomerCore } from '#services/customer/core.js';
import {
  canTouchCustomer,
  type CustomerActor,
  type CustomerCreateInput,
  type CustomerDeleteSummary,
  type CustomerDeps,
  type CustomerUpdateInput,
} from '#services/customer/shared.js';
import { invalidateCachedTokenVersion } from '#utils/authz-cache.js';
import {
  customerSelect,
  type SafeCustomer,
} from '#utils/mappers/customer.mapper.js';
import { photoColumnValue } from '#utils/photo-removal.js';

export const makeCustomerWriteService = (
  d: CustomerDeps,
  core: CustomerCore,
) => {
  const { clock, cloudinary, logger, prisma } = d;
  const { assertContactAvailable, cleanupPicture } = core;

  /** POST /customers — staff-side creation (walk-in / phone customers).
   * Always PASSWORDLESS: the customer signs in via OTP login, or claims a
   * password themselves through forgot-password / change-password. */
  const createCustomer = async (
    input: CustomerCreateInput,
  ): Promise<SafeCustomer> => {
    await assertContactAvailable(input);

    return prisma.customer.create({
      data: {
        address: input.address,
        email: input.email,
        name: input.name,
        phone: input.phone,
        profilePicture: input.profilePicture,
      },
      select: customerSelect,
    });
  };

  /**
   * PUT /customers/:id — self or ADMIN/AGENT only. Guard order mirrors the
   * user domain: actor rule → existence → email uniqueness → phone uniqueness
   * → update. A replaced profile picture has its old image cleaned up
   * best-effort; if anything fails after the middleware already uploaded a
   * new image, that fresh upload is reclaimed before rethrowing.
   */
  const updateCustomer = async (
    actor: CustomerActor,
    customerId: number,
    input: CustomerUpdateInput,
  ): Promise<SafeCustomer> => {
    if (!canTouchCustomer(actor, customerId)) {
      throw new UnauthorizedError(
        'You are not authorized to update this customer.',
      );
    }

    const uploadedImageUrl = input.profilePicture;

    try {
      const existing = await prisma.customer.findFirst({
        select: { email: true, phone: true, profilePicture: true },
        where: { id: customerId },
      });
      if (!existing) {
        throw new NotFoundError('Customer not found');
      }

      // Email/phone are LOGIN IDENTIFIERS: a customer editing their OWN
      // profile may no longer change them here — the dedicated verified flows
      // (POST /auth/change-email / /auth/change-phone, which re-authenticate
      // and confirm possession of the new contact) are the only self-service
      // path. Staff edits keep the direct administrative path (zod cannot
      // know the actor, so the rule lives here). Sending the unchanged
      // current value stays a no-op so full-profile form submits keep working.
      const isSelf = actor.kind === 'customer' && actor.id === customerId;
      if (isSelf) {
        if (input.email !== undefined && input.email !== existing.email) {
          throw new BadRequestError(
            'Your email address cannot be changed here. Use POST /auth/change-email, which confirms the new address.',
          );
        }
        if (input.phone !== undefined && input.phone !== existing.phone) {
          throw new BadRequestError(
            'Your phone number cannot be changed here. Use POST /auth/change-phone, which verifies the new number.',
          );
        }
      }

      await assertContactAvailable(
        {
          email: input.email !== existing.email ? input.email : undefined,
          phone: input.phone !== existing.phone ? input.phone : undefined,
        },
        customerId,
      );

      // Prisma ignores undefined keys, so omitted fields stay untouched.
      // Credentials are deliberately NOT writable here — see the input type.
      const updated = await prisma.customer.update({
        data: {
          address: input.address,
          email: input.email,
          name: input.name,
          phone: input.phone,
          profilePicture: photoColumnValue(uploadedImageUrl),
        },
        select: customerSelect,
        where: { id: customerId },
      });

      // Replaced or removed picture: drop the old image now that the row no
      // longer points at it ('' — the removal signal — is covered too).
      if (
        uploadedImageUrl !== undefined &&
        existing.profilePicture &&
        existing.profilePicture !== uploadedImageUrl
      ) {
        await cleanupPicture(
          existing.profilePicture,
          'Failed to clean up old customer profile picture',
        );
      }

      return updated;
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
   * DELETE /customers/:id — ADMIN only (route-gated). A customer with any
   * ACTIVE (pending or confirmed) booking is protected (409) — the user
   * domain's delete guard, adapted to bookings. Soft delete; the profile
   * picture is cleaned up best-effort after the row is tombstoned.
   */
  const deleteCustomer = async (
    customerId: number,
  ): Promise<CustomerDeleteSummary> => {
    const existing = await prisma.customer.findFirst({
      select: { email: true, id: true, name: true, profilePicture: true },
      where: { id: customerId },
    });
    if (!existing) {
      throw new NotFoundError('Customer not found');
    }

    const activeBookings = await prisma.booking.count({
      where: {
        customerId,
        status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
      },
    });
    if (activeBookings > 0) {
      throw new CustomError(
        HTTP_STATUS_CODES.CONFLICT,
        'Cannot delete customer with active (pending or confirmed) bookings. ' +
          'Please cancel or complete the bookings first.',
      );
    }

    // Soft delete: the row survives (deletedAt set); scoped reads hide it.
    await prisma.customer.update({
      data: { deletedAt: clock.now() },
      where: { id: customerId },
    });

    // Deleted accounts must lose access at once, not at cache expiry: the
    // next request re-reads the DB (scoped), finds no row, and is rejected.
    invalidateCachedTokenVersion('customer', customerId);

    if (existing.profilePicture) {
      await cleanupPicture(
        existing.profilePicture,
        `Failed to clean up profile picture for deleted customer ${String(customerId)}`,
      );
    }

    return { email: existing.email, name: existing.name };
  };

  return { createCustomer, deleteCustomer, updateCustomer };
};
