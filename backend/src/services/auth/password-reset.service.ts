// src/services/auth/password-reset.service.ts
//
// Forgot / reset password for BOTH principals (customer first, then staff).
// Request is enumeration-safe and emails a single-use link; reset consumes
// the token, sets the new hash on whichever principal the token FKs, and
// bumps that principal's session epoch.
import bcrypt from 'bcrypt';

import { BCRYPT_SALT_ROUNDS } from '#config/constants.js';
import { TokenType } from '#config/prismaClient.js';
import { UnauthorizedError } from '#middlewares/error-handler.js';
import { type AuthCore } from '#services/auth/core.js';
import {
  type AuthDeps,
  DUMMY_PASSWORD_HASH,
  PASSWORD_RESET_TTL_MINUTES,
} from '#services/auth/shared.js';
import { type PrincipalKind } from '#types/auth.types.js';
import { invalidateCachedTokenVersion } from '#utils/authz-cache.js';
import {
  generateResetToken,
  hashSecurityToken,
} from '#utils/security-token.js';

export const makePasswordResetService = (d: AuthDeps, core: AuthCore) => {
  const { clock, config, logger, notify, prisma } = d;
  const {
    findPrincipalByEmail,
    issueSecurityToken,
    principalFk,
    updateAuthState,
  } = core;

  /**
   * Forgot password — works for BOTH principals (customer first, then staff;
   * first match wins, mirroring login precedence). ALWAYS resolves (never
   * reveals whether the email has an account). For a real account a
   * single-use 256-bit link token is issued (sha256 stored, FK'd to the
   * matched principal) and the reset URL is emailed.
   */
  const requestPasswordReset = async (email: string): Promise<void> => {
    const principal = await findPrincipalByEmail(email);
    const account =
      principal?.kind === 'customer' ? principal.customer : principal?.user;
    if (!principal || !account?.email) {
      // Same dummy work as the known-email path (see requestOtpLogin).
      await bcrypt.compare('reset-timing-guard', DUMMY_PASSWORD_HASH);
      logger.info(
        { event: 'password_reset_unknown_email' },
        'Password reset requested for an unknown email',
      );
      return;
    }

    const token = generateResetToken();
    await issueSecurityToken(
      principal.kind,
      account.id,
      TokenType.PASSWORD_RESET,
      token,
      PASSWORD_RESET_TTL_MINUTES,
    );

    const resetUrl = `${config.FRONTEND_URL}/reset-password?token=${token}`;
    notify.email(
      {
        subject: 'Reset your TravelTrek password',
        text:
          `Hi ${account.name},\n\nWe received a request to reset your password. ` +
          `Use the link below within ${PASSWORD_RESET_TTL_MINUTES} minutes:\n\n` +
          `${resetUrl}\n\nIf you didn't request this, you can ignore this email.`,
        to: account.email,
      },
      'Password-reset email',
    );
    logger.info(
      { kind: principal.kind, principalId: account.id },
      'Password reset email requested',
    );
  };

  /**
   * Redeems a reset link: validates + consumes the token (atomic guarded
   * update — single-use), sets the new bcrypt hash on whichever principal the
   * token row FKs (customer or staff), and bumps that principal's session
   * epoch so every live session on every device must sign in again.
   */
  const resetPassword = async (
    token: string,
    newPassword: string,
  ): Promise<void> => {
    const record = await prisma.userSecurityToken.findUnique({
      where: { tokenHash: hashSecurityToken(token) },
    });
    if (
      record?.type !== TokenType.PASSWORD_RESET ||
      record.consumedAt !== null ||
      record.expiresAt.getTime() < clock.timestamp()
    ) {
      throw new UnauthorizedError(
        'This reset link is invalid or has expired. Request a new one.',
        { code: 'INVALID_RESET_TOKEN', layer: 'auth' },
      );
    }
    const consumed = await prisma.userSecurityToken.updateMany({
      data: { consumedAt: clock.now() },
      where: { consumedAt: null, id: record.id },
    });
    if (consumed.count === 0) {
      throw new UnauthorizedError(
        'This reset link is invalid or has expired. Request a new one.',
        { code: 'INVALID_RESET_TOKEN', layer: 'auth' },
      );
    }

    // The token row records which principal it was issued for (exactly one
    // FK is ever set — DB CHECK).
    const kind: PrincipalKind =
      record.customerId !== null ? 'customer' : 'staff';
    const principalId = record.customerId ?? record.userId;
    if (principalId === null) {
      // Unreachable under the CHECK constraint; fail closed anyway.
      throw new UnauthorizedError(
        'This reset link is invalid or has expired. Request a new one.',
        { code: 'INVALID_RESET_TOKEN', layer: 'auth' },
      );
    }

    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
    await updateAuthState(kind, principalId, {
      password: hashedPassword,
      tokenVersion: { increment: 1 },
    });
    // Drop every other outstanding code/link/refresh registration: the epoch
    // bump already rejects the JWTs, and no stale secret should survive a
    // password change.
    await prisma.userSecurityToken.deleteMany({
      where: { consumedAt: null, ...principalFk(kind, principalId) },
    });
    invalidateCachedTokenVersion(kind, principalId);
  };

  return { requestPasswordReset, resetPassword };
};
