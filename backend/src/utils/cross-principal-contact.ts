// src/utils/cross-principal-contact.ts
//
// Customers and staff live in separate tables, but password login and
// password reset resolve an email by trying Customer FIRST, then User.
// First-match-wins is only safe when a contact can never exist in both
// tables at once: otherwise a public signup could claim a staff member's
// email and shadow their account at login. Every path that writes an email
// or phone to either table must therefore assert the contact is free in the
// OTHER table too (the same-table checks/DB uniques already exist).
import { HTTP_STATUS_CODES } from '#config/constants.js';
import { CustomError } from '#middlewares/error-handler.js';
import { type DbClient } from '#services/deps.js';

/** Which table the caller is about to write to. */
export type PrincipalTable = 'customer' | 'staff';

/**
 * Throws 409 when the email/phone is already held by the OTHER principal
 * table. findUnique on purpose (unscoped): soft-deleted rows keep their
 * unique contact (khadys convention), so a tombstone still blocks the claim.
 * The message deliberately does not say which kind of account holds it.
 */
export const assertContactFreeAcrossPrincipals = async (
  prisma: DbClient,
  contact: { email?: null | string; phone?: null | string },
  writingTo: PrincipalTable,
): Promise<void> => {
  const other =
    writingTo === 'customer'
      ? {
          byEmail: (email: string) =>
            prisma.user.findUnique({ select: { id: true }, where: { email } }),
          byPhone: (phone: string) =>
            prisma.user.findUnique({ select: { id: true }, where: { phone } }),
        }
      : {
          byEmail: (email: string) =>
            prisma.customer.findUnique({
              select: { id: true },
              where: { email },
            }),
          byPhone: (phone: string) =>
            prisma.customer.findUnique({
              select: { id: true },
              where: { phone },
            }),
        };

  if (contact.email && (await other.byEmail(contact.email))) {
    throw new CustomError(
      HTTP_STATUS_CODES.CONFLICT,
      'An account with this email already exists.',
    );
  }

  if (contact.phone && (await other.byPhone(contact.phone))) {
    throw new CustomError(
      HTTP_STATUS_CODES.CONFLICT,
      'An account with this phone number already exists.',
    );
  }
};
