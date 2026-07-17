// src/services/auth/change-password.service.ts
//
// POST /auth/change-password — the ONLY authenticated way to set or rotate a
// password (for both principals). Bumps the session epoch and drops every
// outstanding one-time secret on success, returning the new-epoch principal
// so the controller keeps THIS session signed in.
import bcrypt from 'bcrypt';

import { BCRYPT_SALT_ROUNDS } from '#config/constants.js';
import {
  BadRequestError,
  TooManyRequestsError,
  UnauthorizedError,
} from '#middlewares/error-handler.js';
import { type AuthCore } from '#services/auth/core.js';
import {
  type AuthDeps,
  authState,
  type ChangePasswordInput,
  type TokenPrincipal,
  toTokenPrincipal,
} from '#services/auth/shared.js';
import { type PrincipalKind } from '#types/auth.types.js';
import { invalidateCachedTokenVersion } from '#utils/authz-cache.js';

export const makeChangePasswordService = (d: AuthDeps, core: AuthCore) => {
  const { clock, prisma } = d;
  const {
    findPrincipalById,
    principalFk,
    registerFailedLogin,
    updateAuthState,
  } = core;

  /**
   * POST /auth/change-password (authenticated, both kinds). Two modes:
   *
   * - The account HAS a password: currentPassword is required and must
   *   verify. A mismatch answers the SAME uniform 401 as login and feeds the
   *   login lockout counter (a hijacked session can't grind the password
   *   here any faster than at /auth/login), and a locked account is refused
   *   outright.
   * - The account is PASSWORDLESS (minimal signup / Google / admin-created
   *   staff): currentPassword must be ABSENT — this call sets the first
   *   password.
   *
   * On success the session epoch bumps (every other session/device dies) and
   * every outstanding one-time secret is dropped; the returned principal
   * carries the NEW epoch so the controller can mint fresh tokens and keep
   * THIS session signed in.
   */
  const changePassword = async (
    kind: PrincipalKind,
    principalId: number,
    input: ChangePasswordInput,
  ): Promise<TokenPrincipal> => {
    const principal = await findPrincipalById(kind, principalId);
    if (!principal) {
      throw new UnauthorizedError('Account no longer exists. Please log in.', {
        code: 'USER_NOT_FOUND',
        layer: 'auth',
      });
    }
    const row = authState(principal);

    if (row.password === null) {
      if (input.currentPassword !== undefined) {
        throw new BadRequestError(
          'This account has no password yet — omit currentPassword to set one.',
        );
      }
    } else {
      if (input.currentPassword === undefined) {
        throw new BadRequestError(
          'Current password is required to change your password.',
        );
      }
      // Same lock/verify/counter discipline as login.
      if (row.lockedUntil && row.lockedUntil.getTime() > clock.timestamp()) {
        throw new TooManyRequestsError(
          'Too many failed attempts. Please wait a few minutes and try again.',
          { code: 'ACCOUNT_LOCKED', layer: 'auth' },
        );
      }
      const valid = await bcrypt.compare(input.currentPassword, row.password);
      if (!valid) {
        await registerFailedLogin(principal);
        throw new UnauthorizedError('Invalid credentials', {
          code: 'INVALID_CREDENTIALS',
          layer: 'auth',
        });
      }
    }

    const hashedPassword = await bcrypt.hash(
      input.newPassword,
      BCRYPT_SALT_ROUNDS,
    );
    // Epoch bump: every already-issued token (access + refresh, every
    // device) dies. The controller re-issues THIS session from the returned
    // (new-epoch) principal.
    await updateAuthState(kind, principalId, {
      failedLoginAttempts: 0,
      lockedUntil: null,
      password: hashedPassword,
      tokenVersion: { increment: 1 },
    });
    // No stale one-time secret survives a password change (reset links, OTP
    // codes, refresh registrations — same sweep as resetPassword).
    await prisma.userSecurityToken.deleteMany({
      where: { consumedAt: null, ...principalFk(kind, principalId) },
    });
    invalidateCachedTokenVersion(kind, principalId);

    return {
      ...toTokenPrincipal(principal),
      tokenVersion: row.tokenVersion + 1,
    };
  };

  return { changePassword };
};
