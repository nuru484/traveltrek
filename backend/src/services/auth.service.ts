// src/services/auth.service.ts
//
// Domain logic for authentication over TWO principal tables (Phase 5b):
// customers (the public — registration, OTP, Google) and staff Users
// (ADMIN/AGENT, created only by an admin). Every flow that used to read the
// User table now resolves the right principal:
//
//   - public register / OTP login / Google sign-in → Customer ONLY
//   - password login → Customer by email first, then staff — first match wins
//   - forgot/reset password → Customer first, then staff (the reset-token row
//     records which principal via its userId/customerId FK)
//   - refresh/logout → whichever table the token's `kind` claim names
//
// Everything else is unchanged from the hardened Phase 4b design:
// enumeration-safe login with account lockout, passwordless OTP login (email
// or SMS), refresh-token ROTATION (each refresh token is spendable exactly
// once; a replay outside the tab-race grace window is treated as theft and
// signs the account out everywhere via the tokenVersion session epoch), and
// logout. Token minting is centralized in mintAuthTokens — nothing else signs
// JWTs. The service never touches req/res or cookies (those live in the
// controllers); it takes typed inputs, talks to the injected Prisma client +
// clock + config + mail/sms/google, and throws typed errors. All one-time
// secrets (refresh jtis, OTP codes, reset tokens) are stored as sha256 hashes
// and are single-use.
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';

import { BCRYPT_SALT_ROUNDS } from '#config/constants.js';
import {
  type Customer,
  type Prisma,
  type Role,
  TokenType,
  type User,
} from '#config/prismaClient.js';
import {
  ServiceUnavailableError,
  TooManyRequestsError,
  UnauthorizedError,
} from '#middlewares/error-handler.js';
import { type AppDeps, defaultDeps } from '#services/deps.js';
import {
  AccessTokenPayload,
  PrincipalKind,
  RefreshTokenPayload,
} from '#types/auth.types.js';
import { UserRole } from '#types/user-profile.types.js';
import { invalidateCachedTokenVersion } from '#utils/authz-cache.js';
import { customerSelect } from '#utils/mappers/customer.mapper.js';
import { userSelect } from '#utils/mappers/user.mapper.js';
import {
  generateOtpCode,
  generateResetToken,
  hashSecurityToken,
  parseExpiryMs,
  timingSafeEqualHex,
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

/** OTP login codes: lifetime, wrong-guess cap per code, and the minimum gap
 * between two codes for the same account (khadys's resend-cooldown shape). */
const OTP_TTL_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_SECONDS = 60;

/** Password-reset links are longer-lived than OTPs but still single-use. */
const PASSWORD_RESET_TTL_MINUTES = 30;

/** The account a login/refresh resolved — the controller picks the DTO and
 * mints tokens for whichever principal came back. */
export type AuthPrincipal =
  | { customer: Customer; kind: 'customer' }
  | { kind: 'staff'; user: User };

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

/** How an OTP-login caller identifies the account — validation guarantees
 * exactly one of the two is present. */
export interface OtpContact {
  email?: string;
  phone?: string;
}

export interface RegisterInput {
  address?: string;
  /** Optional: phone-only signups have no email (name + email OR phone). */
  email?: string;
  name: string;
  /** Optional: passwordless accounts sign in via OTP (or Google) instead. */
  password?: string;
  phone?: string;
  /** Cloudinary URL, already uploaded by the route's middleware. */
  profilePicture?: string;
}

/** What mintAuthTokens needs to establish a session for either principal. */
export interface TokenPrincipal {
  id: number;
  kind: PrincipalKind;
  role: UserRole;
  tokenVersion: number;
}

/** Customers have no role column; they always present CUSTOMER on tokens so
 * the existing authorizeRole route gates keep working verbatim. */
export const customerPrincipal = (
  customer: Pick<Customer, 'id' | 'tokenVersion'>,
): TokenPrincipal => ({
  id: customer.id,
  kind: 'customer',
  role: UserRole.CUSTOMER,
  tokenVersion: customer.tokenVersion,
});

export const staffPrincipal = (
  user: Pick<User, 'id' | 'role' | 'tokenVersion'>,
): TokenPrincipal => ({
  id: user.id,
  kind: 'staff',
  role: user.role as UserRole,
  tokenVersion: user.tokenVersion,
});

export const toTokenPrincipal = (principal: AuthPrincipal): TokenPrincipal =>
  principal.kind === 'customer'
    ? customerPrincipal(principal.customer)
    : staffPrincipal(principal.user);

/** The auth-state columns customers and staff share (same names and types in
 * both tables), so the login/lockout logic runs once for either principal. */
type AuthStateRow = Pick<
  User,
  'failedLoginAttempts' | 'id' | 'lockedUntil' | 'password' | 'tokenVersion'
>;

const authState = (principal: AuthPrincipal): AuthStateRow =>
  principal.kind === 'customer' ? principal.customer : principal.user;

type AuthDeps = Pick<
  AppDeps,
  'clock' | 'config' | 'google' | 'logger' | 'mail' | 'prisma' | 'sms'
>;

/** The password-free customer shape plus tokenVersion, so the registration
 * controller can mint a session without a second read. */
const registeredCustomerSelect = {
  ...customerSelect,
  tokenVersion: true,
} satisfies Prisma.CustomerSelect;

export type RegisteredCustomer = Prisma.CustomerGetPayload<{
  select: typeof registeredCustomerSelect;
}>;

/** Same idea for admin-created staff users. */
const registeredUserSelect = {
  ...userSelect,
  tokenVersion: true,
} satisfies Prisma.UserSelect;

export type RegisteredUser = Prisma.UserGetPayload<{
  select: typeof registeredUserSelect;
}>;

export const makeAuthService = (d: AuthDeps) => {
  const { clock, config, google, logger, mail, prisma, sms } = d;

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
      failedLoginAttempts?: number;
      lockedUntil?: Date | null;
      password?: string;
      tokenVersion?: { increment: number };
    },
  ): Promise<unknown> =>
    kind === 'customer'
      ? prisma.customer.update({ data, where: { id } })
      : prisma.user.update({ data, where: { id } });

  /** Public self-service signup: ALWAYS creates a Customer — there is no role
   * concept on the public surface (staff are created by an admin). */
  const register = async (
    input: RegisterInput,
  ): Promise<RegisteredCustomer> => {
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
   * the public signup, never here. */
  const adminCreateUser = async (
    input: RegisterInput,
    role: Role,
  ): Promise<RegisteredUser> => {
    const hashedPassword =
      input.password === undefined
        ? null
        : await bcrypt.hash(input.password, BCRYPT_SALT_ROUNDS);
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

  /**
   * Verifies email + password and returns the resolved principal (the
   * controller mints tokens / sets cookies). Customer first, then staff —
   * first match wins. Uniform "Invalid credentials" (same status, same
   * timing) for unknown-email, passwordless-account and wrong-password, for
   * BOTH principal kinds — no user enumeration.
   */
  const login = async (input: LoginInput): Promise<AuthPrincipal> => {
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

    return principal;
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

  /** Whether a security-token row belongs to the given principal (the FK
   * column must match the token's kind — ids overlap across the tables). */
  const recordBelongsTo = (
    record: { customerId: null | number; userId: null | number },
    kind: PrincipalKind,
    id: number,
  ): boolean =>
    kind === 'customer' ? record.customerId === id : record.userId === id;

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

    // findFirst: a soft-deleted account can no longer refresh a session.
    const principal: AuthPrincipal | null =
      kind === 'customer'
        ? await prisma.customer
            .findFirst({ where: { id: decoded.id } })
            .then((customer) =>
              customer ? { customer, kind: 'customer' as const } : null,
            )
        : await prisma.user
            .findFirst({ where: { id: decoded.id } })
            .then((user) => (user ? { kind: 'staff' as const, user } : null));
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

  // ---- Passwordless OTP login, password reset, Google sign-in ----

  /** Fire-and-forget delivery: a slow/failed send never blocks or fails the
   * request (and keeps request-OTP / forgot-password timing uniform). */
  const dispatch = (delivery: Promise<void>, what: string): void => {
    void delivery.catch((error: unknown) => {
      logger.error({ err: error }, `${what} dispatch threw`);
    });
  };

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

  /**
   * Requests a passwordless login code (customers only). ALWAYS resolves for
   * unknown contacts (same response as known ones — no enumeration); for a
   * real account a 6-digit code is issued (replacing any prior live one) and
   * sent to the channel the caller identified themselves by. Re-requests
   * inside the cooldown are silently dropped: a 429 here would only ever fire
   * for contacts that HAVE an account, leaking existence — the response must
   * be indistinguishable from the unknown-contact path. Abuse control is the
   * per-IP rate limiter on the route.
   */
  const requestOtpLogin = async (contact: OtpContact): Promise<void> => {
    const customer = await findCustomerByContact(contact);
    if (!customer) {
      // Spend comparable work to the known-contact path so response timing
      // doesn't reveal whether the contact has an account.
      await bcrypt.compare('otp-timing-guard', DUMMY_PASSWORD_HASH);
      logger.info(
        { event: 'otp_login_unknown_contact' },
        'OTP login requested for an unknown contact',
      );
      return;
    }

    const latest = await prisma.userSecurityToken.findFirst({
      orderBy: { createdAt: 'desc' },
      where: { customerId: customer.id, type: TokenType.OTP_LOGIN },
    });
    if (
      latest &&
      clock.timestamp() - latest.createdAt.getTime() <
        OTP_RESEND_COOLDOWN_SECONDS * 1000
    ) {
      logger.info(
        { customerId: customer.id, event: 'otp_login_cooldown' },
        'OTP re-request inside cooldown dropped',
      );
      return;
    }

    const code = generateOtpCode();
    await issueSecurityToken(
      'customer',
      customer.id,
      TokenType.OTP_LOGIN,
      code,
      OTP_TTL_MINUTES,
    );

    const message = `Your TravelTrek login code is ${code}. It expires in ${OTP_TTL_MINUTES} minutes.`;
    if (contact.email && customer.email) {
      dispatch(
        mail.send({
          subject: 'Your TravelTrek login code',
          text: message,
          to: customer.email,
        }),
        'OTP email',
      );
    } else if (contact.phone && customer.phone) {
      dispatch(sms.send({ message, to: customer.phone }), 'OTP SMS');
    }
  };

  /**
   * Verifies a passwordless login code and returns the customer (the
   * controller mints tokens / sets cookies). Wrong guesses increment the
   * code's attempt counter — at the cap the code is dead and a fresh one must
   * be requested. A correct guess is consumed atomically (redeemable at most
   * once) and clears any password-failure lockout state.
   */
  const verifyOtpLogin = async (
    contact: OtpContact,
    code: string,
  ): Promise<Customer> => {
    const customer = await findCustomerByContact(contact);
    if (!customer) throw invalidOtpError();

    const record = await prisma.userSecurityToken.findFirst({
      orderBy: { createdAt: 'desc' },
      where: {
        consumedAt: null,
        customerId: customer.id,
        type: TokenType.OTP_LOGIN,
      },
    });
    if (
      !record ||
      record.expiresAt.getTime() < clock.timestamp() ||
      record.attempts >= OTP_MAX_ATTEMPTS
    ) {
      throw invalidOtpError();
    }

    if (!timingSafeEqualHex(record.tokenHash, hashSecurityToken(code))) {
      await prisma.userSecurityToken.update({
        data: { attempts: { increment: 1 } },
        where: { id: record.id },
      });
      throw invalidOtpError();
    }

    // Guarded consume: two concurrent verifies race here and only one wins.
    const consumed = await prisma.userSecurityToken.updateMany({
      data: { consumedAt: clock.now() },
      where: { consumedAt: null, id: record.id },
    });
    if (consumed.count === 0) throw invalidOtpError();

    // A successful OTP login is as good as a correct password: clear the
    // failure counter and any temporary lock.
    if (customer.failedLoginAttempts > 0 || customer.lockedUntil) {
      await updateAuthState('customer', customer.id, {
        failedLoginAttempts: 0,
        lockedUntil: null,
      });
    }

    return customer;
  };

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
    dispatch(
      mail.send({
        subject: 'Reset your TravelTrek password',
        text:
          `Hi ${account.name},\n\nWe received a request to reset your password. ` +
          `Use the link below within ${PASSWORD_RESET_TTL_MINUTES} minutes:\n\n` +
          `${resetUrl}\n\nIf you didn't request this, you can ignore this email.`,
        to: account.email,
      }),
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
    const kind: PrincipalKind = record.customerId !== null ? 'customer' : 'staff';
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

  /**
   * Google sign-in — a CUSTOMER-ONLY surface: verifies the ID token via the
   * injected google client, then resolves the account — by googleId first,
   * else by verified email (linking the googleId for next time), else a fresh
   * passwordless Customer. The controller mints tokens / sets cookies for the
   * returned customer. Staff never authenticate via Google.
   */
  const googleSignIn = async (idToken: string): Promise<Customer> => {
    if (!config.GOOGLE_CLIENT_ID) {
      throw new ServiceUnavailableError('Google sign-in is not configured', {
        code: 'GOOGLE_NOT_CONFIGURED',
        layer: 'auth',
      });
    }

    const identity = await google.verifyIdToken(idToken);
    if (!identity) {
      throw new UnauthorizedError('Google sign-in failed. Please try again.', {
        code: 'INVALID_GOOGLE_TOKEN',
        layer: 'auth',
      });
    }

    // findFirst on both lookups: a soft-deleted account can neither sign in
    // nor be linked. Its unique email/googleId stay held (khadys convention),
    // so a re-signup for that identity surfaces as a P2002 conflict.
    const byGoogleId = await prisma.customer.findFirst({
      where: { googleId: identity.googleId },
    });
    if (byGoogleId) return byGoogleId;

    // Only a VERIFIED Google email may claim an existing account (or mint a
    // new one) — otherwise anyone could register an unverified Google account
    // with someone else's address and take over their profile.
    if (!identity.emailVerified) {
      throw new UnauthorizedError(
        'Your Google account email is not verified.',
        { code: 'GOOGLE_EMAIL_UNVERIFIED', layer: 'auth' },
      );
    }

    const byEmail = await prisma.customer.findFirst({
      where: { email: identity.email },
    });
    if (byEmail) {
      return prisma.customer.update({
        data: { googleId: identity.googleId },
        where: { id: byEmail.id },
      });
    }

    return prisma.customer.create({
      data: {
        email: identity.email,
        googleId: identity.googleId,
        name: identity.name,
      },
    });
  };

  return {
    adminCreateUser,
    googleSignIn,
    invalidateSession,
    login,
    logout,
    mintAuthTokens,
    refresh,
    register,
    requestOtpLogin,
    requestPasswordReset,
    resetPassword,
    verifyOtpLogin,
  };
};

export const authService = makeAuthService(defaultDeps);

export const {
  adminCreateUser,
  googleSignIn,
  invalidateSession,
  login,
  logout,
  mintAuthTokens,
  refresh,
  register,
  requestOtpLogin,
  requestPasswordReset,
  resetPassword,
  verifyOtpLogin,
} = authService;
