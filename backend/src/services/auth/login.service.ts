// src/services/auth/login.service.ts
//
// Password login (with the 2FA hand-off), refresh-token rotation, and logout.
// Session minting/rotation primitives and principal resolution live in the
// auth core; this module owns the three request-facing flows.
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';

import { TokenType } from '#config/prismaClient.js';
import {
  TooManyRequestsError,
  UnauthorizedError,
} from '#middlewares/error-handler.js';
import { type AuthCore } from '#services/auth/core.js';
import {
  type AuthDeps,
  type AuthPrincipal,
  authState,
  type AuthTokens,
  DUMMY_PASSWORD_HASH,
  type LoginInput,
  type LoginResult,
  REFRESH_REUSE_GRACE_MS,
  toTokenPrincipal,
} from '#services/auth/shared.js';
import { type RefreshTokenPayload } from '#types/auth.types.js';
import { invalidateCachedTokenVersion } from '#utils/authz-cache.js';
import { hashSecurityToken } from '#utils/security-token.js';
import { verifyJwtToken } from '#utils/verify-jwt-token.js';

// jsonwebtoken is CJS — its error classes aren't detectable as named ESM
// exports, so destructure them off the default export.
const { TokenExpiredError } = jwt;

export const makeLoginService = (d: AuthDeps, core: AuthCore) => {
  const { clock, config, logger, prisma } = d;
  const {
    findPrincipalByEmail,
    findPrincipalById,
    invalidateSession,
    invalidRefreshError,
    isPrincipalKind,
    issueTwoFactorChallenge,
    principalFk,
    recordBelongsTo,
    registerFailedLogin,
    registerRefreshToken,
    signAuthTokens,
    updateAuthState,
  } = core;

  /**
   * Verifies email + password and returns the resolved principal plus whether
   * a second factor is still owed. Customer first, then staff — first match
   * wins. Uniform "Invalid credentials" (same status, same timing) for
   * unknown-email, passwordless-account and wrong-password, for BOTH
   * principal kinds — no user enumeration.
   *
   * 2FA applies to PASSWORD login only: when the principal has
   * twoFactorEnabled a TWO_FACTOR code is sent and NO session may be issued —
   * the controller sets the pending cookie and /auth/2fa/verify completes the
   * login. OTP login and Google sign-in already prove possession of the
   * account's channel/identity (a single possession factor), so they BYPASS
   * the flag by design.
   */
  const login = async (input: LoginInput): Promise<LoginResult> => {
    const principal = await findPrincipalByEmail(input.email);
    const row = principal ? authState(principal) : null;

    // Passwordless accounts (minimal signup / Google) have no hash to check —
    // the dummy compare keeps their timing identical to unknown emails.
    if (!principal || row?.password == null) {
      await bcrypt.compare(input.password, DUMMY_PASSWORD_HASH);
      throw new UnauthorizedError('Invalid credentials', {
        code: 'INVALID_CREDENTIALS',
        layer: 'auth',
      });
    }

    // Temporary lock after repeated failures. Unknown emails never reach here
    // (no row to lock), so this can't be used to enumerate accounts blindly.
    if (row.lockedUntil && row.lockedUntil.getTime() > clock.timestamp()) {
      throw new TooManyRequestsError(
        'Too many failed attempts. Please wait a few minutes and try again.',
        { code: 'ACCOUNT_LOCKED', layer: 'auth' },
      );
    }

    const passwordValid = await bcrypt.compare(input.password, row.password);
    if (!passwordValid) {
      await registerFailedLogin(principal);
      throw new UnauthorizedError('Invalid credentials', {
        code: 'INVALID_CREDENTIALS',
        layer: 'auth',
      });
    }

    // A correct password clears the failure counter.
    if (row.failedLoginAttempts > 0 || row.lockedUntil) {
      await updateAuthState(principal.kind, row.id, {
        failedLoginAttempts: 0,
        lockedUntil: null,
      });
    }

    // The password alone is not enough for a 2FA account: challenge the
    // second factor and withhold the session.
    if (row.twoFactorEnabled) {
      await issueTwoFactorChallenge(principal);
      return { principal, twoFactorRequired: true };
    }

    return { principal, twoFactorRequired: false };
  };

  /**
   * Exchanges a refresh JWT for a fresh access+refresh pair (full rotation):
   * verifies the JWT, resolves the principal its `kind` claim names, confirms
   * the session epoch still matches, and consumes the token's rotation id — a
   * refresh token is spendable exactly once. A replay of an already-spent
   * token outside the concurrency grace window means the cookie exists in two
   * places (theft), so the session epoch is bumped and every device is signed
   * out.
   */
  const refresh = async (
    presentedToken: string,
  ): Promise<{ principal: AuthPrincipal; tokens: AuthTokens }> => {
    let decoded: RefreshTokenPayload;
    try {
      decoded = await verifyJwtToken<RefreshTokenPayload>(
        presentedToken,
        config.REFRESH_TOKEN_SECRET,
      );
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        throw new UnauthorizedError(
          'Your session has expired. Please log in again.',
          { code: 'REFRESH_EXPIRED', layer: 'auth' },
        );
      }
      throw invalidRefreshError();
    }

    // Tokens minted before the customer/staff split name no principal table
    // and can't be resolved — their holders just log in again.
    if (!isPrincipalKind(decoded.kind)) throw invalidRefreshError();
    const kind = decoded.kind;

    // findFirst inside: a soft-deleted account can no longer refresh a session.
    const principal = await findPrincipalById(kind, decoded.id);
    if (!principal) {
      throw new UnauthorizedError('Account not found. Please log in again.', {
        code: 'USER_NOT_FOUND',
        layer: 'auth',
      });
    }
    const row = authState(principal);
    if (decoded.tokenVersion !== row.tokenVersion) {
      throw new UnauthorizedError(
        'Session has been invalidated. Please log in again.',
        { code: 'STALE_TOKEN_VERSION', layer: 'auth' },
      );
    }
    // Tokens minted before rotation existed carry no jti — they can't be
    // tracked, so they can't be exchanged. Their holders just log in again.
    if (!decoded.jti) throw invalidRefreshError();

    const record = await prisma.userSecurityToken.findUnique({
      where: { tokenHash: hashSecurityToken(decoded.jti) },
    });
    if (
      !record ||
      !recordBelongsTo(record, kind, row.id) ||
      record.type !== TokenType.REFRESH ||
      record.expiresAt.getTime() < clock.timestamp()
    ) {
      throw invalidRefreshError();
    }

    if (record.consumedAt !== null) {
      const ageMs = clock.timestamp() - record.consumedAt.getTime();
      if (ageMs > REFRESH_REUSE_GRACE_MS) {
        // The token was already spent and this replay is too old to be a
        // tab race: someone else holds the cookie. Kill every session.
        await invalidateSession(kind, row.id);
        logger.warn(
          { kind, principalId: row.id },
          'Refresh-token reuse detected — session epoch bumped',
        );
      }
      throw new UnauthorizedError(
        'Session has been invalidated. Please log in again.',
        { code: 'REFRESH_REUSED', layer: 'auth' },
      );
    }

    // Guarded consume: two concurrent exchanges race here and only one wins.
    // The successor's hash is recorded on the spent row (rotation audit trail).
    const successorJti = crypto.randomUUID();
    const consumed = await prisma.userSecurityToken.updateMany({
      data: {
        consumedAt: clock.now(),
        replacedByTokenHash: hashSecurityToken(successorJti),
      },
      where: { consumedAt: null, id: record.id },
    });
    if (consumed.count === 0) {
      throw new UnauthorizedError(
        'Session has been invalidated. Please log in again.',
        { code: 'REFRESH_REUSED', layer: 'auth' },
      );
    }

    await registerRefreshToken(kind, row.id, successorJti);
    return {
      principal,
      tokens: signAuthTokens(toTokenPrincipal(principal), successorJti),
    };
  };

  /**
   * Logout: consume the presented refresh token's registration (against the
   * principal the token names) so it can never be exchanged again — the
   * controller clears the cookies. Tolerates a missing/garbage token —
   * "log out" never errors.
   */
  const logout = async (presentedToken: null | string): Promise<void> => {
    if (!presentedToken) return;

    let decoded: RefreshTokenPayload;
    try {
      decoded = await verifyJwtToken<RefreshTokenPayload>(
        presentedToken,
        config.REFRESH_TOKEN_SECRET,
      );
    } catch (error) {
      logger.warn({ err: error }, 'Logout: could not decode refresh token');
      return;
    }

    if (!isPrincipalKind(decoded.kind)) return;

    if (decoded.jti) {
      await prisma.userSecurityToken.updateMany({
        data: { consumedAt: clock.now() },
        where: {
          consumedAt: null,
          tokenHash: hashSecurityToken(decoded.jti),
          type: TokenType.REFRESH,
          ...principalFk(decoded.kind, decoded.id),
        },
      });
    }
    invalidateCachedTokenVersion(decoded.kind, decoded.id);
  };

  return { login, logout, refresh };
};
