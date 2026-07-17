// src/services/auth/contact-change.service.ts
//
// Self-service contact changes (dms email-change pattern). Email and phone are
// LOGIN IDENTIFIERS, so changing one is a re-auth + prove-possession flow that
// only applies the new value once confirmed, bumping the session epoch. The
// re-auth / cross-table guards and the uniform error factories live in core.
import { TokenType } from '#config/prismaClient.js';
import {
  BadRequestError,
  UnauthorizedError,
} from '#middlewares/error-handler.js';
import { type AuthCore } from '#services/auth/core.js';
import {
  type AuthDeps,
  authState,
  type ChangeEmailInput,
  type ChangePhoneInput,
  EMAIL_CHANGE_TTL_MINUTES,
  PHONE_CHANGE_MAX_ATTEMPTS,
  PHONE_CHANGE_TTL_MINUTES,
  principalRow,
  type TokenPrincipal,
  toTokenPrincipal,
} from '#services/auth/shared.js';
import { type PrincipalKind } from '#types/auth.types.js';
import { invalidateCachedTokenVersion } from '#utils/authz-cache.js';
import { assertContactFreeAcrossPrincipals } from '#utils/cross-principal-contact.js';
import {
  generateOtpCode,
  generateResetToken,
  hashSecurityToken,
} from '#utils/security-token.js';

export const makeContactChangeService = (d: AuthDeps, core: AuthCore) => {
  const { clock, config, logger, notify, prisma } = d;
  const {
    assertContactFreeSameTable,
    assertReauthenticated,
    consumeSecurityCode,
    findPrincipalById,
    invalidEmailChangeError,
    invalidPhoneChangeError,
    issueSecurityToken,
    principalFk,
    updateAuthState,
  } = core;

  /**
   * POST /auth/change-email — parks the new address on pendingEmail and sends
   * the single-use confirmation link (32-byte token, sha256-stored, 30min
   * TTL) to the NEW address; nothing changes until the link is redeemed.
   * Uniqueness is pre-checked here for early feedback and RE-checked at
   * confirm time (the authoritative check).
   */
  const requestEmailChange = async (
    kind: PrincipalKind,
    principalId: number,
    input: ChangeEmailInput,
  ): Promise<void> => {
    const principal = await findPrincipalById(kind, principalId);
    if (!principal) {
      throw new UnauthorizedError('Account no longer exists. Please log in.', {
        code: 'USER_NOT_FOUND',
        layer: 'auth',
      });
    }
    const row = principalRow(principal);
    if (row.email === input.newEmail) {
      throw new BadRequestError('This is already your email address.');
    }

    await assertReauthenticated(principal, input);
    await assertContactFreeSameTable(kind, principalId, {
      email: input.newEmail,
    });
    await assertContactFreeAcrossPrincipals(
      prisma,
      { email: input.newEmail },
      kind,
    );

    await updateAuthState(kind, principalId, { pendingEmail: input.newEmail });

    const token = generateResetToken();
    await issueSecurityToken(
      kind,
      principalId,
      TokenType.EMAIL_CHANGE,
      token,
      EMAIL_CHANGE_TTL_MINUTES,
    );

    const confirmUrl = `${config.FRONTEND_URL}/confirm-email-change?token=${token}`;
    notify.email(
      {
        subject: 'Confirm your new TravelTrek email address',
        text:
          `Hi ${row.name},\n\n` +
          `Use the link below within ${EMAIL_CHANGE_TTL_MINUTES} minutes to confirm ` +
          `${input.newEmail} as the new email address for your TravelTrek account:\n\n` +
          `${confirmUrl}\n\n` +
          `Until you confirm, your account keeps its current email. ` +
          `If you didn't request this change, you can ignore this message.`,
        to: input.newEmail,
      },
      'Email-change confirmation email',
    );
    logger.info({ kind, principalId }, 'Email change requested');
  };

  /**
   * POST /auth/confirm-email-change — UNauthenticated (the emailed token is
   * the credential, like reset-password). Consumes the token (atomic,
   * single-use), re-checks uniqueness in BOTH tables (a conflict clears the
   * pending change and 409s), applies pendingEmail → email and bumps the
   * session epoch so every live session must sign in with the new email.
   */
  const confirmEmailChange = async (token: string): Promise<void> => {
    const record = await prisma.userSecurityToken.findUnique({
      where: { tokenHash: hashSecurityToken(token) },
    });
    if (
      record?.type !== TokenType.EMAIL_CHANGE ||
      record.consumedAt !== null ||
      record.expiresAt.getTime() < clock.timestamp()
    ) {
      throw invalidEmailChangeError();
    }
    const consumed = await prisma.userSecurityToken.updateMany({
      data: { consumedAt: clock.now() },
      where: { consumedAt: null, id: record.id },
    });
    if (consumed.count === 0) throw invalidEmailChangeError();

    const kind: PrincipalKind =
      record.customerId !== null ? 'customer' : 'staff';
    const principalId = record.customerId ?? record.userId;
    if (principalId === null) throw invalidEmailChangeError();

    const principal = await findPrincipalById(kind, principalId);
    if (!principal) throw invalidEmailChangeError();
    const pendingEmail = principalRow(principal).pendingEmail;
    if (!pendingEmail) throw invalidEmailChangeError();

    // The address may have been claimed between request and confirm; a
    // conflict clears the pending change so the account isn't left wedged.
    try {
      await assertContactFreeSameTable(kind, principalId, {
        email: pendingEmail,
      });
      await assertContactFreeAcrossPrincipals(
        prisma,
        { email: pendingEmail },
        kind,
      );
    } catch (error) {
      await updateAuthState(kind, principalId, { pendingEmail: null });
      throw error;
    }

    await updateAuthState(kind, principalId, {
      email: pendingEmail,
      pendingEmail: null,
      tokenVersion: { increment: 1 },
    });
    // No stale one-time secret survives an identifier change (same sweep as
    // resetPassword); the epoch bump already killed the JWTs.
    await prisma.userSecurityToken.deleteMany({
      where: { consumedAt: null, ...principalFk(kind, principalId) },
    });
    invalidateCachedTokenVersion(kind, principalId);
    logger.info({ kind, principalId }, 'Email change confirmed');
  };

  /**
   * POST /auth/change-phone — parks the new number on pendingPhone and texts
   * a single-use OTP (PHONE_CHANGE) to the NEW phone; confirming the code
   * proves possession of that number.
   */
  const requestPhoneChange = async (
    kind: PrincipalKind,
    principalId: number,
    input: ChangePhoneInput,
  ): Promise<void> => {
    const principal = await findPrincipalById(kind, principalId);
    if (!principal) {
      throw new UnauthorizedError('Account no longer exists. Please log in.', {
        code: 'USER_NOT_FOUND',
        layer: 'auth',
      });
    }
    const row = principalRow(principal);
    if (row.phone === input.newPhone) {
      throw new BadRequestError('This is already your phone number.');
    }

    await assertReauthenticated(principal, input);
    await assertContactFreeSameTable(kind, principalId, {
      phone: input.newPhone,
    });
    await assertContactFreeAcrossPrincipals(
      prisma,
      { phone: input.newPhone },
      kind,
    );

    await updateAuthState(kind, principalId, { pendingPhone: input.newPhone });

    const code = generateOtpCode();
    await issueSecurityToken(
      kind,
      principalId,
      TokenType.PHONE_CHANGE,
      code,
      PHONE_CHANGE_TTL_MINUTES,
    );
    notify.sms(
      {
        message: `Your TravelTrek verification code is ${code}. It expires in ${PHONE_CHANGE_TTL_MINUTES} minutes.`,
        to: input.newPhone,
      },
      'Phone-change OTP SMS',
    );
    logger.info({ kind, principalId }, 'Phone change requested');
  };

  /**
   * POST /auth/confirm-phone-change — AUTHENTICATED (the code proves
   * possession of the new phone; the session proves the account). Consumes
   * the PHONE_CHANGE code (attempt-capped), re-checks uniqueness in both
   * tables, applies pendingPhone → phone and bumps the session epoch. Returns
   * the new-epoch principal so the controller re-mints THIS session.
   */
  const confirmPhoneChange = async (
    kind: PrincipalKind,
    principalId: number,
    code: string,
  ): Promise<TokenPrincipal> => {
    const principal = await findPrincipalById(kind, principalId);
    if (!principal) throw invalidPhoneChangeError();
    const row = principalRow(principal);
    if (!row.pendingPhone) throw invalidPhoneChangeError();

    await consumeSecurityCode(
      kind,
      principalId,
      TokenType.PHONE_CHANGE,
      code,
      PHONE_CHANGE_MAX_ATTEMPTS,
      invalidPhoneChangeError,
    );

    // The number may have been claimed between request and confirm; a
    // conflict clears the pending change so the account isn't left wedged.
    try {
      await assertContactFreeSameTable(kind, principalId, {
        phone: row.pendingPhone,
      });
      await assertContactFreeAcrossPrincipals(
        prisma,
        { phone: row.pendingPhone },
        kind,
      );
    } catch (error) {
      await updateAuthState(kind, principalId, { pendingPhone: null });
      throw error;
    }

    await updateAuthState(kind, principalId, {
      pendingPhone: null,
      phone: row.pendingPhone,
      tokenVersion: { increment: 1 },
    });
    await prisma.userSecurityToken.deleteMany({
      where: { consumedAt: null, ...principalFk(kind, principalId) },
    });
    invalidateCachedTokenVersion(kind, principalId);
    logger.info({ kind, principalId }, 'Phone change confirmed');

    return {
      ...toTokenPrincipal(principal),
      tokenVersion: authState(principal).tokenVersion + 1,
    };
  };

  return {
    confirmEmailChange,
    confirmPhoneChange,
    requestEmailChange,
    requestPhoneChange,
  };
};
