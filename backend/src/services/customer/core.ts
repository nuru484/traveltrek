// src/services/customer/core.ts
//
// The shared customers engine: best-effort profile-picture cleanup, the
// cross-table contact-uniqueness pre-check, and the scoped existence read
// every per-customer function starts from. Built once per deps.
import { HTTP_STATUS_CODES } from '#config/constants.js';
import { CustomError, NotFoundError } from '#middlewares/error-handler.js';
import {
  type CustomerDeps,
  type CustomerUpdateInput,
} from '#services/customer/shared.js';
import { assertContactFreeAcrossPrincipals } from '#utils/cross-principal-contact.js';
import {
  customerSelect,
  type SafeCustomer,
} from '#utils/mappers/customer.mapper.js';

export type CustomerCore = ReturnType<typeof makeCustomerCore>;

export const makeCustomerCore = (d: CustomerDeps) => {
  const { cloudinary, logger, prisma } = d;

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

  /** Uniqueness pre-checks use findUnique ON PURPOSE (unscoped): the DB
   * unique constraints span soft-deleted rows, so a tombstoned customer
   * still holds its email/phone and the pre-check must see it, or the write
   * would die on a raw P2002 instead. */
  const assertContactAvailable = async (
    input: Pick<CustomerUpdateInput, 'email' | 'phone'>,
    excludeId?: number,
  ): Promise<void> => {
    if (input.email) {
      const byEmail = await prisma.customer.findUnique({
        where: { email: input.email },
      });
      if (byEmail && byEmail.id !== excludeId) {
        throw new CustomError(
          HTTP_STATUS_CODES.CONFLICT,
          'A customer with this email already exists.',
        );
      }
    }

    if (input.phone) {
      const byPhone = await prisma.customer.findUnique({
        where: { phone: input.phone },
      });
      if (byPhone && byPhone.id !== excludeId) {
        throw new CustomError(
          HTTP_STATUS_CODES.CONFLICT,
          'A customer with this phone number already exists.',
        );
      }
    }

    // Login/reset resolve contacts customer-first, so a contact held by a
    // STAFF account must be just as unavailable as one held by a customer.
    await assertContactFreeAcrossPrincipals(prisma, input, 'customer');
  };

  /** The scoped existence read every per-customer function starts from. */
  const findCustomerOr404 = async (
    customerId: number,
  ): Promise<SafeCustomer> => {
    // findFirst so soft-deleted customers 404 like hard-deleted ones would.
    const customer = await prisma.customer.findFirst({
      select: customerSelect,
      where: { id: customerId },
    });
    if (!customer) throw new NotFoundError('Customer not found');
    return customer;
  };

  return { assertContactAvailable, cleanupPicture, findCustomerOr404 };
};
