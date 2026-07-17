// src/services/auth/registration.service.ts
//
// Account creation: public self-service signup (always a Customer) and
// admin-only staff creation (always passwordless). Neither needs the auth
// core — they only write their table and run the cross-principal contact
// guard, so this factory takes just the deps.
import bcrypt from 'bcrypt';

import { BCRYPT_SALT_ROUNDS } from '#config/constants.js';
import { type Role } from '#config/prismaClient.js';
import {
  type AuthDeps,
  type RegisteredCustomer,
  registeredCustomerSelect,
  type RegisteredUser,
  registeredUserSelect,
  type RegisterInput,
} from '#services/auth/shared.js';
import { assertContactFreeAcrossPrincipals } from '#utils/cross-principal-contact.js';

export const makeRegistrationService = (d: AuthDeps) => {
  const { prisma } = d;

  /** Public self-service signup: ALWAYS creates a Customer — there is no role
   * concept on the public surface (staff are created by an admin). */
  const register = async (
    input: RegisterInput,
  ): Promise<RegisteredCustomer> => {
    // A staff member's contact must never be claimable by a public signup —
    // the customer row would shadow the staff account at login.
    await assertContactFreeAcrossPrincipals(prisma, input, 'customer');
    const hashedPassword =
      input.password === undefined
        ? null
        : await bcrypt.hash(input.password, BCRYPT_SALT_ROUNDS);
    return prisma.customer.create({
      data: {
        address: input.address,
        email: input.email,
        name: input.name,
        password: hashedPassword,
        phone: input.phone,
        profilePicture: input.profilePicture,
      },
      select: registeredCustomerSelect,
    });
  };

  /** Admin staff creation (POST /users): the role is required and validation
   * restricts it to ADMIN | AGENT — customers are created via /customers or
   * the public signup, never here. Admins never set passwords: the account is
   * created PASSWORDLESS and its owner establishes one via forgot-password
   * (OTP login is customer-only) — so no shared secret ever transits an
   * admin. */
  const adminCreateUser = async (
    input: Omit<RegisterInput, 'password'>,
    role: Role,
  ): Promise<RegisteredUser> => {
    // Symmetric guard: a staff account must not claim a customer's contact.
    await assertContactFreeAcrossPrincipals(prisma, input, 'staff');
    return prisma.user.create({
      data: {
        address: input.address,
        email: input.email,
        name: input.name,
        password: null,
        phone: input.phone,
        profilePicture: input.profilePicture,
        role,
      },
      select: registeredUserSelect,
    });
  };

  return { adminCreateUser, register };
};
