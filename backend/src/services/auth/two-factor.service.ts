// src/services/auth/two-factor.service.ts
//
// Two-factor endpoints: the login second step (verify/resend) and the
// authenticated enable/disable/status/challenge surface. The challenge
// primitives (issue/send/cooldown) live in the auth core; this module owns
// the request-facing flows built on them.
import { TokenType } from '#config/prismaClient.js';
import {
  BadRequestError,
  UnauthorizedError,
} from '#middlewares/error-handler.js';
import { type AuthCore } from '#services/auth/core.js';
import {
  type AuthDeps,
  type AuthPrincipal,
  authState,
  principalRow,
  TWO_FACTOR_MAX_ATTEMPTS,
  twoFactorChannel,
  type TwoFactorStatus,
} from '#services/auth/shared.js';
import { type PrincipalKind } from '#types/auth.types.js';

export const makeTwoFactorService = (d: AuthDeps, core: AuthCore) => {
  const { logger, prisma } = d;
  const {
    consumeSecurityCode,
    findPrincipalById,
    insideTwoFactorCooldown,
    invalidTwoFactorError,
    issueTwoFactorChallenge,
    principalFk,
    updateAuthState,
  } = core;

  /**
   * Login second step: redeems the TWO_FACTOR code for the principal the
   * pending cookie vouches for and returns that principal (the controller
   * mints tokens / sets cookies — the same envelope as a plain login).
   * Uniform 401 on every failure mode; wrong guesses feed the attempts cap.
   */
  const verifyTwoFactorLogin = async (
    kind: PrincipalKind,
    principalId: number,
    code: string,
  ): Promise<AuthPrincipal> => {
    const principal = await findPrincipalById(kind, principalId);
    // The account vanished mid-login (deleted during the pending window) —
    // indistinguishable from a bad code on purpose.
    if (!principal) throw invalidTwoFactorError();

    await consumeSecurityCode(
      kind,
      principalId,
      TokenType.TWO_FACTOR,
      code,
      TWO_FACTOR_MAX_ATTEMPTS,
      invalidTwoFactorError,
    );
    return principal;
  };

  /**
   * Re-sends the login challenge for a pending 2FA login. Re-requests inside
   * the 60s cooldown are SILENTLY dropped (the response is always the same
   * 200 — no oracle for whether a code went out); a vanished account is
   * likewise silent. Volume abuse is the route's per-IP limiter.
   */
  const resendTwoFactorLogin = async (
    kind: PrincipalKind,
    principalId: number,
  ): Promise<void> => {
    const principal = await findPrincipalById(kind, principalId);
    if (!principal) return;

    if (await insideTwoFactorCooldown(kind, principalId)) {
      logger.info(
        { event: 'two_factor_cooldown', kind, principalId },
        '2FA re-request inside cooldown dropped',
      );
      return;
    }
    await issueTwoFactorChallenge(principal);
  };

  /**
   * Authed challenge (POST /auth/2fa/challenge): sends the code that BOTH
   * enable and disable then consume — the same possession proof gates the
   * flag in both directions. 400 when the account has no delivery channel
   * (neither email nor phone). Cooldown re-requests are silently dropped,
   * mirroring the login resend.
   */
  const requestTwoFactorChallenge = async (
    kind: PrincipalKind,
    principalId: number,
  ): Promise<void> => {
    const principal = await findPrincipalById(kind, principalId);
    if (!principal) {
      throw new UnauthorizedError('Account no longer exists. Please log in.', {
        code: 'USER_NOT_FOUND',
        layer: 'auth',
      });
    }
    const row = principalRow(principal);
    if (!twoFactorChannel(row)) {
      throw new BadRequestError(
        'Add an email address or phone number to your profile before using two-factor authentication.',
      );
    }

    if (await insideTwoFactorCooldown(kind, principalId)) {
      logger.info(
        { event: 'two_factor_cooldown', kind, principalId },
        '2FA challenge re-request inside cooldown dropped',
      );
      return;
    }
    await issueTwoFactorChallenge(principal);
  };

  /** Enables 2FA after the challenge code verifies (POST /auth/2fa/enable). */
  const enableTwoFactor = async (
    kind: PrincipalKind,
    principalId: number,
    code: string,
  ): Promise<void> => {
    const principal = await findPrincipalById(kind, principalId);
    if (!principal) {
      throw new UnauthorizedError('Account no longer exists. Please log in.', {
        code: 'USER_NOT_FOUND',
        layer: 'auth',
      });
    }
    if (authState(principal).twoFactorEnabled) {
      throw new BadRequestError('Two-factor authentication is already enabled');
    }

    await consumeSecurityCode(
      kind,
      principalId,
      TokenType.TWO_FACTOR,
      code,
      TWO_FACTOR_MAX_ATTEMPTS,
      invalidTwoFactorError,
    );
    await updateAuthState(kind, principalId, { twoFactorEnabled: true });
  };

  /** Disables 2FA — gated by the SAME challenge+code proof as enabling, so a
   * hijacked session alone can't switch the protection off. Outstanding
   * TWO_FACTOR codes are dropped with the flag. */
  const disableTwoFactor = async (
    kind: PrincipalKind,
    principalId: number,
    code: string,
  ): Promise<void> => {
    const principal = await findPrincipalById(kind, principalId);
    if (!principal) {
      throw new UnauthorizedError('Account no longer exists. Please log in.', {
        code: 'USER_NOT_FOUND',
        layer: 'auth',
      });
    }
    if (!authState(principal).twoFactorEnabled) {
      throw new BadRequestError('Two-factor authentication is not enabled');
    }

    await consumeSecurityCode(
      kind,
      principalId,
      TokenType.TWO_FACTOR,
      code,
      TWO_FACTOR_MAX_ATTEMPTS,
      invalidTwoFactorError,
    );
    await updateAuthState(kind, principalId, { twoFactorEnabled: false });
    await prisma.userSecurityToken.deleteMany({
      where: {
        consumedAt: null,
        type: TokenType.TWO_FACTOR,
        ...principalFk(kind, principalId),
      },
    });
  };

  /** GET /auth/2fa/status — whether 2FA is on and which channel codes use. */
  const getTwoFactorStatus = async (
    kind: PrincipalKind,
    principalId: number,
  ): Promise<TwoFactorStatus> => {
    const principal = await findPrincipalById(kind, principalId);
    if (!principal) {
      throw new UnauthorizedError('Account no longer exists. Please log in.', {
        code: 'USER_NOT_FOUND',
        layer: 'auth',
      });
    }
    const row = principalRow(principal);
    return {
      channel: twoFactorChannel(row),
      enabled: row.twoFactorEnabled,
    };
  };

  return {
    disableTwoFactor,
    enableTwoFactor,
    getTwoFactorStatus,
    requestTwoFactorChallenge,
    resendTwoFactorLogin,
    verifyTwoFactorLogin,
  };
};
