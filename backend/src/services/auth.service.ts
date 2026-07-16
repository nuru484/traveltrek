// src/services/auth.service.ts
//
// Domain logic for authentication: registration, enumeration-safe password
// login with account lockout, refresh-token ROTATION (each refresh token is
// spendable exactly once; a replay outside the tab-race grace window is
// treated as theft and signs the account out everywhere via the tokenVersion
// session epoch), and logout. Token minting is centralized in mintAuthTokens —
// nothing else signs JWTs. The service never touches req/res or cookies
// (those live in the controllers); it takes typed inputs, talks to the
// injected Prisma client + clock + config, and throws typed errors. Refresh
// jtis are stored as sha256 hashes and are single-use.
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';

import { BCRYPT_SALT_ROUNDS } from '#config/constants.js';
import {
  type Prisma,
  Role,
  TokenType,
  type User,
} from '#config/prismaClient.js';
import {
  TooManyRequestsError,
  UnauthorizedError,
} from '#middlewares/error-handler.js';
import { type AppDeps, defaultDeps } from '#services/deps.js';
import {
  AccessTokenPayload,
  RefreshTokenPayload,
} from '#types/auth.types.js';
import { UserRole } from '#types/user-profile.types.js';
import { invalidateCachedTokenVersion } from '#utils/authz-cache.js';
import { userSelect } from '#utils/mappers/user.mapper.js';
import {
  hashSecurityToken,
  parseExpiryMs,
} from '#utils/security-token.js';
import { verifyJwtToken } from '#utils/verify-jwt-token.js';

// jsonwebtoken is CJS — its error classes aren't detectable as named ESM
// exports, so destructure them off the default export.
const { TokenExpiredError } = jwt;

/**
 * A fixed bcrypt hash to compare against when an email doesn't exist, so the
 * login path spends the same time whether or not the account is real — closing
 * the timing side-channel that would otherwise leak which emails are registered.
 */
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(
  'enumeration-timing-guard',
  BCRYPT_SALT_ROUNDS,
);

/** After this many consecutive failed passwords, an account is briefly locked to
 * blunt per-account brute force (the per-IP limiter doesn't stop a botnet). */
const MAX_FAILED_LOGINS = 5;
const LOGIN_LOCK_MINUTES = 15;

/** Two overlapping tabs can race to exchange the same refresh cookie; a
 * replay this soon after consumption is that race, not theft, so it is
 * rejected without nuking the whole account. */
const REFRESH_REUSE_GRACE_MS = 30_000;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  address?: string;
  email: string;
  name: string;
  password: string;
  phone?: string;
  /** Cloudinary URL, already uploaded by the route's middleware. */
  profilePicture?: string;
}

type AuthDeps = Pick<AppDeps, 'clock' | 'config' | 'logger' | 'prisma'>;

/** The password-free user shape plus tokenVersion, so the registration
 * controller can mint a session without a second read. */
const registeredUserSelect = {
  ...userSelect,
  tokenVersion: true,
} satisfies Prisma.UserSelect;

export type RegisteredUser = Prisma.UserGetPayload<{
  select: typeof registeredUserSelect;
}>;

export const makeAuthService = (d: AuthDeps) => {
  const { clock, config, logger, prisma } = d;

  /** Persists a user with the given role; the password is hashed here. */
  const createUser = async (
    input: RegisterInput,
    role: Role,
  ): Promise<RegisteredUser> => {
    const hashedPassword = await bcrypt.hash(
      input.password,
      BCRYPT_SALT_ROUNDS,
    );
    return prisma.user.create({
      data: {
        address: input.address,
        email: input.email,
        name: input.name,
        password: hashedPassword,
        phone: input.phone,
        profilePicture: input.profilePicture,
        role,
      },
      select: registeredUserSelect,
    });
  };

  /** Public self-service signup: the role is ALWAYS forced to CUSTOMER —
   * whatever the request body claimed. */
  const register = (input: RegisterInput): Promise<RegisteredUser> =>
    createUser(input, Role.CUSTOMER);

  /** Admin user creation (POST /users): takes the role explicitly. */
  const adminCreateUser = (
    input: RegisterInput,
    role: Role = Role.CUSTOMER,
  ): Promise<RegisteredUser> => createUser(input, role);

  /**
   * Registers a refresh-token id (jti) for a session being issued. The issuer
   * embeds it in the refresh JWT; refresh consumes it on exchange, so each
   * refresh token is spendable exactly once.
   */
  const registerRefreshToken = async (
    userId: number,
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
        userId,
      },
    });
  };

  /** Signs the access/refresh pair for a session — the ONLY place JWTs are
   * signed. The refresh token carries the registered rotation id as its jti. */
  const signAuthTokens = (
    user: Pick<User, 'id' | 'role' | 'tokenVersion'>,
    refreshJti: string,
  ): AuthTokens => {
    const accessPayload: AccessTokenPayload = {
      id: user.id,
      role: user.role as UserRole,
      tokenVersion: user.tokenVersion,
    };
    const refreshPayload: Omit<RefreshTokenPayload, 'jti'> = {
      id: user.id,
      tokenVersion: user.tokenVersion,
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
    user: Pick<User, 'id' | 'role' | 'tokenVersion'>,
  ): Promise<AuthTokens> => {
    const jti = crypto.randomUUID();
    await registerRefreshToken(user.id, jti);
    return signAuthTokens(user, jti);
  };

  /** Records a failed password attempt; locks the account once the threshold is
   * crossed, then resets the counter so the next window starts fresh. */
  const registerFailedLogin = async (user: User): Promise<void> => {
    const attempts = user.failedLoginAttempts + 1;
    const locked = attempts >= MAX_FAILED_LOGINS;
    await prisma.user.update({
      data: {
        failedLoginAttempts: locked ? 0 : attempts,
        lockedUntil: locked
          ? new Date(clock.timestamp() + LOGIN_LOCK_MINUTES * 60_000)
          : undefined,
      },
      where: { id: user.id },
    });
  };

  /**
   * Verifies email + password and returns the user (the controller mints
   * tokens / sets cookies). Uniform "Invalid credentials" (same status, same
   * timing) for both unknown-email and wrong-password — no user enumeration.
   */
  const login = async (input: LoginInput): Promise<User> => {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (!user) {
      await bcrypt.compare(input.password, DUMMY_PASSWORD_HASH);
      throw new UnauthorizedError('Invalid credentials', {
        code: 'INVALID_CREDENTIALS',
        layer: 'auth',
      });
    }

    // Temporary lock after repeated failures. Unknown emails never reach here
    // (no row to lock), so this can't be used to enumerate accounts blindly.
    if (user.lockedUntil && user.lockedUntil.getTime() > clock.timestamp()) {
      throw new TooManyRequestsError(
        'Too many failed attempts. Please wait a few minutes and try again.',
        { code: 'ACCOUNT_LOCKED', layer: 'auth' },
      );
    }

    const passwordValid = await bcrypt.compare(input.password, user.password);
    if (!passwordValid) {
      await registerFailedLogin(user);
      throw new UnauthorizedError('Invalid credentials', {
        code: 'INVALID_CREDENTIALS',
        layer: 'auth',
      });
    }

    // A correct password clears the failure counter.
    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      await prisma.user.update({
        data: { failedLoginAttempts: 0, lockedUntil: null },
        where: { id: user.id },
      });
    }

    return user;
  };

  /** Theft response: bump the session epoch so every issued token (access +
   * refresh, every device) dies, and drop the now-unusable registrations. */
  const invalidateSession = async (userId: number): Promise<void> => {
    await prisma.user.update({
      data: { tokenVersion: { increment: 1 } },
      where: { id: userId },
    });
    // The epoch bump already rejects them; dropping the rows keeps the table
    // from accumulating registrations that can never be exchanged.
    await prisma.userSecurityToken.deleteMany({
      where: {
        consumedAt: null,
        type: TokenType.REFRESH,
        userId,
      },
    });
    invalidateCachedTokenVersion(userId);
  };

  const invalidRefreshError = (): UnauthorizedError =>
    new UnauthorizedError('Invalid refresh token. Please log in again.', {
      code: 'INVALID_REFRESH',
      layer: 'auth',
    });

  /**
   * Exchanges a refresh JWT for a fresh access+refresh pair (full rotation):
   * verifies the JWT, confirms the session epoch still matches, and consumes
   * the token's rotation id — a refresh token is spendable exactly once. A
   * replay of an already-spent token outside the concurrency grace window
   * means the cookie exists in two places (theft), so the session epoch is
   * bumped and every device is signed out.
   */
  const refresh = async (
    presentedToken: string,
  ): Promise<{ tokens: AuthTokens; user: User }> => {
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

    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user) {
      throw new UnauthorizedError('Account not found. Please log in again.', {
        code: 'USER_NOT_FOUND',
        layer: 'auth',
      });
    }
    if (decoded.tokenVersion !== user.tokenVersion) {
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
      record?.userId !== user.id ||
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
        await invalidateSession(user.id);
        logger.warn(
          { userId: user.id },
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

    await registerRefreshToken(user.id, successorJti);
    return { tokens: signAuthTokens(user, successorJti), user };
  };

  /**
   * Logout: consume the presented refresh token's registration so it can
   * never be exchanged again (the controller clears the cookies). Tolerates a
   * missing/garbage token — "log out" never errors.
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

    if (decoded.jti) {
      await prisma.userSecurityToken.updateMany({
        data: { consumedAt: clock.now() },
        where: {
          consumedAt: null,
          tokenHash: hashSecurityToken(decoded.jti),
          type: TokenType.REFRESH,
          userId: decoded.id,
        },
      });
    }
    invalidateCachedTokenVersion(decoded.id);
  };

  return {
    adminCreateUser,
    invalidateSession,
    login,
    logout,
    mintAuthTokens,
    refresh,
    register,
  };
};

export const authService = makeAuthService(defaultDeps);

export const {
  adminCreateUser,
  invalidateSession,
  login,
  logout,
  mintAuthTokens,
  refresh,
  register,
} = authService;
