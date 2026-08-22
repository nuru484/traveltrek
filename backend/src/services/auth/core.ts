// src/services/auth/core.ts
//
// The shared auth engine: every closure the feature modules build on —
// principal resolution, session/lockout state, token minting and rotation
// registration, the single-use security-code issue/consume engine, the 2FA
// challenge primitives, and the re-auth / cross-table contact guards. Built
// once per deps in makeAuthCore(d); each feature factory receives the
// returned AuthCore and destructures what it needs. No HTTP, no cookies.
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';

import { HTTP_STATUS_CODES } from '#config/constants.js';
import { type Customer, TokenType } from '#config/prismaClient.js';
import {
  BadRequestError,
  CustomError,
  TooManyRequestsError,
  UnauthorizedError,
} from '#middlewares/error-handler.js';
import {
  type AuthDeps,
  type AuthPrincipal,
  authState,
  type AuthTokens,
  LOGIN_LOCK_MINUTES,
  MAX_FAILED_LOGINS,
  type OtpContact,
  principalRow,
  type TokenPrincipal,
  TWO_FACTOR_MAX_ATTEMPTS,
  TWO_FACTOR_RESEND_COOLDOWN_SECONDS,
  TWO_FACTOR_TTL_MINUTES,
} from '#services/auth/shared.js';
import {
  type AccessTokenPayload,
  type PrincipalKind,
  type RefreshTokenPayload,
} from '#types/auth.types.js';
import { invalidateCachedTokenVersion } from '#utils/authz-cache.js';
import {
  generateOtpCode,
  hashSecurityToken,
  parseExpiryMs,
  timingSafeEqualHex,
} from '#utils/security-token.js';

export type AuthCore = ReturnType<typeof makeAuthCore>;

export const makeAuthCore = (d: AuthDeps) => {
  const { clock, config, logger, notify, prisma } = d;

  /** The security-token FK column for a principal — exactly one is ever set
   * per row (DB CHECK + this being the only writer). */
  const principalFk = (
    kind: PrincipalKind,
    id: number,
  ): { customerId: number } | { userId: number } =>
    kind === 'customer' ? { customerId: id } : { userId: id };

  /** Writes login/lockout/credential state to whichever table owns the
   * principal (the shared-column shape keeps both branches identical). */
  const updateAuthState = (
    kind: PrincipalKind,
    id: number,
    data: {
      email?: string;
      failedLoginAttempts?: number;
      lockedUntil?: Date | null;
      password?: string;
      pendingEmail?: null | string;
      pendingPhone?: null | string;
      phone?: string;
      tokenVersion?: { increment: number };
      twoFactorEnabled?: boolean;
    },
  ): Promise<unknown> =>
    kind === 'customer'
      ? prisma.customer.update({ data, where: { id } })
      : prisma.user.update({ data, where: { id } });
  /**
   * Registers a refresh-token id (jti) for a session being issued, against
   * the principal's FK column. The issuer embeds it in the refresh JWT;
   * refresh consumes it on exchange, so each refresh token is spendable
   * exactly once.
   */
  const registerRefreshToken = async (
    kind: PrincipalKind,
    principalId: number,
    jti: string,
  ): Promise<void> => {
    await prisma.userSecurityToken.create({
      data: {
        expiresAt: new Date(
          clock.timestamp() +
            parseExpiryMs(config.REFRESH_TOKEN_EXPIRY, 7 * 86_400_000),
        ),
        tokenHash: hashSecurityToken(jti),
        type: TokenType.REFRESH,
        ...principalFk(kind, principalId),
      },
    });
  };

  /** Signs the access/refresh pair for a session — the ONLY place JWTs are
   * signed. The refresh token carries the registered rotation id as its jti;
   * both tokens carry the principal kind. */
  const signAuthTokens = (
    principal: TokenPrincipal,
    refreshJti: string,
  ): AuthTokens => {
    const accessPayload: AccessTokenPayload = {
      id: principal.id,
      kind: principal.kind,
      role: principal.role,
      tokenVersion: principal.tokenVersion,
    };
    const refreshPayload: Omit<RefreshTokenPayload, 'jti'> = {
      id: principal.id,
      kind: principal.kind,
      tokenVersion: principal.tokenVersion,
    };

    const accessToken = jwt.sign(accessPayload, config.ACCESS_TOKEN_SECRET, {
      expiresIn: config.ACCESS_TOKEN_EXPIRY as jwt.SignOptions['expiresIn'],
    });
    const refreshToken = jwt.sign(refreshPayload, config.REFRESH_TOKEN_SECRET, {
      expiresIn: config.REFRESH_TOKEN_EXPIRY as jwt.SignOptions['expiresIn'],
      jwtid: refreshJti,
    });

    return { accessToken, refreshToken };
  };

  /** Establishes a session: registers a fresh rotation id and signs the pair.
   * Used by register, login and refresh — the single session issuer. */
  const mintAuthTokens = async (
    principal: TokenPrincipal,
  ): Promise<AuthTokens> => {
    const jti = crypto.randomUUID();
    await registerRefreshToken(principal.kind, principal.id, jti);
    return signAuthTokens(principal, jti);
  };

  /** Records a failed password attempt; locks the account once the threshold is
   * crossed, then resets the counter so the next window starts fresh. */
  const registerFailedLogin = async (
    principal: AuthPrincipal,
  ): Promise<void> => {
    const row = authState(principal);
    const attempts = row.failedLoginAttempts + 1;
    const locked = attempts >= MAX_FAILED_LOGINS;
    await updateAuthState(principal.kind, row.id, {
      failedLoginAttempts: locked ? 0 : attempts,
      lockedUntil: locked
        ? new Date(clock.timestamp() + LOGIN_LOCK_MINUTES * 60_000)
        : undefined,
    });
  };

  /** Resolves the principal an email names: Customer first, then staff —
   * FIRST MATCH WINS, so a customer sharing an email with a staff account
   * always logs in as the customer. */
  const findPrincipalByEmail = async (
    email: string,
  ): Promise<AuthPrincipal | null> => {
    // findFirst so the soft-delete extension scopes both reads: a
    // soft-deleted account behaves exactly like an unknown email.
    const customer = await prisma.customer.findFirst({ where: { email } });
    if (customer) return { customer, kind: 'customer' };

    const user = await prisma.user.findFirst({ where: { email } });
    if (user) return { kind: 'staff', user };

    return null;
  };
  /** Theft response: bump the principal's session epoch so every issued token
   * (access + refresh, every device) dies, and drop the now-unusable
   * registrations. */
  const invalidateSession = async (
    kind: PrincipalKind,
    principalId: number,
  ): Promise<void> => {
    await updateAuthState(kind, principalId, {
      tokenVersion: { increment: 1 },
    });
    // The epoch bump already rejects them; dropping the rows keeps the table
    // from accumulating registrations that can never be exchanged.
    await prisma.userSecurityToken.deleteMany({
      where: {
        consumedAt: null,
        type: TokenType.REFRESH,
        ...principalFk(kind, principalId),
      },
    });
    invalidateCachedTokenVersion(kind, principalId);
  };

  const invalidRefreshError = (): UnauthorizedError =>
    new UnauthorizedError('Invalid refresh token. Please log in again.', {
      code: 'INVALID_REFRESH',
      layer: 'auth',
    });

  const isPrincipalKind = (value: unknown): value is PrincipalKind =>
    value === 'customer' || value === 'staff';

  /** Resolves a principal by (kind, id) — the tables have overlapping ids, so
   * the kind picks the table. findFirst: soft-deleted accounts read as gone. */
  const findPrincipalById = (
    kind: PrincipalKind,
    id: number,
  ): Promise<AuthPrincipal | null> =>
    kind === 'customer'
      ? prisma.customer
          .findFirst({ where: { id } })
          .then((customer) =>
            customer ? { customer, kind: 'customer' as const } : null,
          )
      : prisma.user
          .findFirst({ where: { id } })
          .then((user) => (user ? { kind: 'staff' as const, user } : null));

  /** Whether a security-token row belongs to the given principal (the FK
   * column must match the token's kind — ids overlap across the tables). */
  const recordBelongsTo = (
    record: { customerId: null | number; userId: null | number },
    kind: PrincipalKind,
    id: number,
  ): boolean =>
    kind === 'customer' ? record.customerId === id : record.userId === id;

  /** Resolves the CUSTOMER an OTP request/verify identifies (email or phone).
   * OTP login is a customer-only surface — staff use passwords. */
  const findCustomerByContact = (
    contact: OtpContact,
  ): Promise<Customer | null> => {
    // findFirst: soft-deleted accounts read as unknown contacts.
    if (contact.email) {
      return prisma.customer.findFirst({ where: { email: contact.email } });
    }
    if (contact.phone) {
      return prisma.customer.findFirst({ where: { phone: contact.phone } });
    }
    return Promise.resolve(null);
  };

  /** One live token per (principal, type): issuing a new one drops any prior
   * unconsumed tokens of that type. Only the sha256 hash is stored. */
  const issueSecurityToken = async (
    kind: PrincipalKind,
    principalId: number,
    type: TokenType,
    plainToken: string,
    ttlMinutes: number,
  ): Promise<void> => {
    const fk = principalFk(kind, principalId);
    await prisma.userSecurityToken.deleteMany({
      where: { consumedAt: null, type, ...fk },
    });
    await prisma.userSecurityToken.create({
      data: {
        expiresAt: new Date(clock.timestamp() + ttlMinutes * 60_000),
        tokenHash: hashSecurityToken(plainToken),
        type,
        ...fk,
      },
    });
  };

  /** Every OTP failure mode (unknown contact, no live code, expired, dead
   * from too many guesses, wrong code) collapses into this one uniform 401
   * so responses never reveal WHY a code was refused. */
  const invalidOtpError = (): UnauthorizedError =>
    new UnauthorizedError(
      'Your code is invalid or has expired. Request a new one.',
      { code: 'INVALID_OTP', layer: 'auth' },
    );

  /** Same uniform-401 discipline for TWO_FACTOR codes (login second step,
   * enable/disable confirmation) — a distinct code for the frontend only. */
  const invalidTwoFactorError = (): UnauthorizedError =>
    new UnauthorizedError(
      'Your code is invalid or has expired. Request a new one.',
      { code: 'INVALID_2FA_CODE', layer: 'auth' },
    );

  /**
   * Verifies and consumes the live security code of (principal, type): the
   * shared engine behind OTP login and every TWO_FACTOR check. Uniform
   * failure (the caller's error) for no-live-code / expired / attempt-capped
   * / wrong code — wrong guesses feed the attempts counter, and a correct
   * guess is consumed atomically (redeemable at most once, races lose).
   */
  const consumeSecurityCode = async (
    kind: PrincipalKind,
    principalId: number,
    type: TokenType,
    code: string,
    maxAttempts: number,
    invalidError: () => UnauthorizedError,
  ): Promise<void> => {
    const record = await prisma.userSecurityToken.findFirst({
      orderBy: { createdAt: 'desc' },
      where: { consumedAt: null, type, ...principalFk(kind, principalId) },
    });
    if (
      !record ||
      record.expiresAt.getTime() < clock.timestamp() ||
      record.attempts >= maxAttempts
    ) {
      throw invalidError();
    }

    if (!timingSafeEqualHex(record.tokenHash, hashSecurityToken(code))) {
      await prisma.userSecurityToken.update({
        data: { attempts: { increment: 1 } },
        where: { id: record.id },
      });
      throw invalidError();
    }

    // Guarded consume: two concurrent verifies race here and only one wins.
    const consumed = await prisma.userSecurityToken.updateMany({
      data: { consumedAt: clock.now() },
      where: { consumedAt: null, id: record.id },
    });
    if (consumed.count === 0) throw invalidError();
  };

  /** Sends a TWO_FACTOR code over the principal's channel — email preferred,
   * SMS otherwise. Fire-and-forget like every other code delivery. */
  const sendTwoFactorCode = (principal: AuthPrincipal, code: string): void => {
    const row = principalRow(principal);
    const message = `Your TravelTrek verification code is ${code}. It expires in ${String(TWO_FACTOR_TTL_MINUTES)} minutes.`;
    if (row.email) {
      notify.email(
        {
          subject: 'Your TravelTrek verification code',
          text: message,
          to: row.email,
        },
        '2FA email',
      );
    } else if (row.phone) {
      notify.sms({ message, to: row.phone }, '2FA SMS');
    } else {
      // Unreachable in practice: enabling requires a channel and profile
      // updates never null contacts out. Fail closed (no session either way).
      logger.error(
        { kind: principal.kind, principalId: row.id },
        '2FA code issued for a principal with no delivery channel',
      );
    }
  };

  /** Issues a fresh TWO_FACTOR code (replacing any prior live one) and sends
   * it — the shared engine behind login challenges and enable/disable. */
  const issueTwoFactorChallenge = async (
    principal: AuthPrincipal,
  ): Promise<void> => {
    const code = generateOtpCode();
    await issueSecurityToken(
      principal.kind,
      principalRow(principal).id,
      TokenType.TWO_FACTOR,
      code,
      TWO_FACTOR_TTL_MINUTES,
    );
    sendTwoFactorCode(principal, code);
  };

  /** Whether the latest TWO_FACTOR code for the principal was issued inside
   * the cooldown window (consumed or not — issuance is what's throttled). */
  const insideTwoFactorCooldown = async (
    kind: PrincipalKind,
    principalId: number,
  ): Promise<boolean> => {
    const latest = await prisma.userSecurityToken.findFirst({
      orderBy: { createdAt: 'desc' },
      where: { type: TokenType.TWO_FACTOR, ...principalFk(kind, principalId) },
    });
    return (
      latest !== null &&
      clock.timestamp() - latest.createdAt.getTime() <
        TWO_FACTOR_RESEND_COOLDOWN_SECONDS * 1000
    );
  };

  /**
   * Re-auth proof for a contact change: accounts WITH a password must present
   * it (same lockout/counter discipline as login — a hijacked session can't
   * grind the password here); passwordless accounts must present the code
   * POST /auth/reauth/challenge sent to their CURRENT contact.
   */
  const assertReauthenticated = async (
    principal: AuthPrincipal,
    proof: { code?: string; currentPassword?: string },
  ): Promise<void> => {
    const row = authState(principal);

    if (row.password !== null) {
      if (proof.currentPassword === undefined) {
        throw new BadRequestError(
          'Enter your current password to change your contact details.',
        );
      }
      if (row.lockedUntil && row.lockedUntil.getTime() > clock.timestamp()) {
        throw new TooManyRequestsError(
          'Too many failed attempts. Please wait a few minutes and try again.',
          { code: 'ACCOUNT_LOCKED', layer: 'auth' },
        );
      }
      const valid = await bcrypt.compare(proof.currentPassword, row.password);
      if (!valid) {
        await registerFailedLogin(principal);
        throw new UnauthorizedError('Invalid credentials', {
          code: 'INVALID_CREDENTIALS',
          layer: 'auth',
        });
      }
      return;
    }

    if (proof.code === undefined) {
      throw new BadRequestError(
        'This account has no password — request a verification code first (POST /auth/reauth/challenge) and send it as "code".',
      );
    }
    await consumeSecurityCode(
      principal.kind,
      row.id,
      TokenType.TWO_FACTOR,
      proof.code,
      TWO_FACTOR_MAX_ATTEMPTS,
      invalidTwoFactorError,
    );
  };

  /**
   * 409 when another row of the SAME principal table already holds the
   * contact. findUnique on purpose (unscoped): soft-deleted rows keep their
   * unique contact, so a tombstone still blocks the claim. The cross-table
   * half is assertContactFreeAcrossPrincipals.
   */
  const assertContactFreeSameTable = async (
    kind: PrincipalKind,
    principalId: number,
    contact: { email?: string; phone?: string },
  ): Promise<void> => {
    if (contact.email) {
      const holder =
        kind === 'customer'
          ? await prisma.customer.findUnique({
              select: { id: true },
              where: { email: contact.email },
            })
          : await prisma.user.findUnique({
              select: { id: true },
              where: { email: contact.email },
            });
      if (holder && holder.id !== principalId) {
        throw new CustomError(
          HTTP_STATUS_CODES.CONFLICT,
          'An account with this email already exists.',
        );
      }
    }

    if (contact.phone) {
      const holder =
        kind === 'customer'
          ? await prisma.customer.findUnique({
              select: { id: true },
              where: { phone: contact.phone },
            })
          : await prisma.user.findUnique({
              select: { id: true },
              where: { phone: contact.phone },
            });
      if (holder && holder.id !== principalId) {
        throw new CustomError(
          HTTP_STATUS_CODES.CONFLICT,
          'An account with this phone number already exists.',
        );
      }
    }
  };

  /** Every confirm-link failure mode (unknown/expired/consumed token, gone
   * account, no pending change) collapses into one uniform 401. */
  const invalidEmailChangeError = (): UnauthorizedError =>
    new UnauthorizedError(
      'This confirmation link is invalid or has expired. Request the email change again.',
      { code: 'INVALID_EMAIL_CHANGE_TOKEN', layer: 'auth' },
    );

  /** Uniform 401 for phone-change codes, mirroring the OTP discipline. */
  const invalidPhoneChangeError = (): UnauthorizedError =>
    new UnauthorizedError(
      'Your code is invalid or has expired. Request a new one.',
      { code: 'INVALID_PHONE_CHANGE_CODE', layer: 'auth' },
    );

  return {
    assertContactFreeSameTable,
    assertReauthenticated,
    consumeSecurityCode,
    findCustomerByContact,
    findPrincipalByEmail,
    findPrincipalById,
    insideTwoFactorCooldown,
    invalidateSession,
    invalidEmailChangeError,
    invalidOtpError,
    invalidPhoneChangeError,
    invalidRefreshError,
    invalidTwoFactorError,
    isPrincipalKind,
    issueSecurityToken,
    issueTwoFactorChallenge,
    mintAuthTokens,
    principalFk,
    recordBelongsTo,
    registerFailedLogin,
    registerRefreshToken,
    sendTwoFactorCode,
    signAuthTokens,
    updateAuthState,
  };
};
