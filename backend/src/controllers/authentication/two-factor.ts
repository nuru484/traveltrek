// src/controllers/authentication/two-factor.ts
//
// Two-factor authentication over BOTH principals (customer + staff), khadys
// pattern adapted to kind-tagged identities and email/SMS channels:
//
// - Login second step (verify/resend): UNauthenticated, gated by the signed
//   twoFactorPending cookie the login controller set — it proves the password
//   step without granting any access. verify redeems the code and completes
//   the login with the exact envelope a plain login answers.
// - Management (challenge/enable/disable/status): a full session required
//   (routed behind authenticate-jwt). Challenge sends the code that BOTH
//   enable and disable consume — the same channel-possession proof gates the
//   flag in both directions.
//
// OTP login and Google sign-in BYPASS 2FA by design (each is already a single
// possession factor) — documented on the service.
import { Request, RequestHandler, Response } from 'express';

import {
  asyncHandler,
  UnauthorizedError,
} from '#middlewares/error-handler.js';
import zodValidation from '#middlewares/validate-request.js';
import {
  disableTwoFactor as disableTwoFactorService,
  enableTwoFactor as enableTwoFactorService,
  getTwoFactorStatus,
  mintAuthTokens,
  requestTwoFactorChallenge,
  resendTwoFactorLogin,
  toTokenPrincipal,
  verifyTwoFactorLogin,
} from '#services/auth.service.js';
import { AccessTokenPayload } from '#types/auth.types.js';
import { CookieManager } from '#utils/CookieManager.js';
import { sendSuccess } from '#utils/http-response.js';
import { toCustomerDTO } from '#utils/mappers/customer.mapper.js';
import { toUserDTO } from '#utils/mappers/user.mapper.js';
import {
  TwoFactorPendingPrincipal,
  verifyTwoFactorPendingToken,
} from '#utils/two-factor-pending.js';
import {
  TwoFactorCodeBody,
  twoFactorCodeSchema,
} from '#validations/auth-validation.js';

/** Resolves the mid-login principal from the pending-2FA cookie. Absent and
 * invalid/expired cookies collapse into the same 401. */
const resolvePendingPrincipal = async (
  req: Request,
): Promise<TwoFactorPendingPrincipal> => {
  const token = CookieManager.getTwoFactorPendingToken(req);
  if (!token) {
    throw new UnauthorizedError(
      'Your login session expired. Please sign in again.',
      { code: 'MISSING_2FA_SESSION', layer: 'auth' },
    );
  }
  return verifyTwoFactorPendingToken(token);
};

/** Narrows req.user (set by authenticate-jwt) for the management endpoints. */
const requireActor = (req: Request): AccessTokenPayload => {
  const { user } = req;
  if (!user) {
    throw new UnauthorizedError('Unauthorized, no user provided');
  }
  return user;
};

// --- Login second step (unauthenticated; gated by the pending cookie) ---

const handleVerify = asyncHandler(async (req: Request, res: Response) => {
  const { code } = req.body as TwoFactorCodeBody;
  const pending = await resolvePendingPrincipal(req);

  const principal = await verifyTwoFactorLogin(pending.kind, pending.id, code);
  const tokens = await mintAuthTokens(toTokenPrincipal(principal));

  // The pending proof is spent; the session replaces it — same success
  // envelope as a plain (non-2FA) login.
  CookieManager.clearTwoFactorPendingToken(res);
  CookieManager.setAuthTokens(res, tokens);
  sendSuccess(res, {
    data:
      principal.kind === 'customer'
        ? toCustomerDTO(principal.customer)
        : toUserDTO(principal.user),
    message: 'Login successful',
  });
});

export const verifyTwoFactor: RequestHandler[] = [
  ...zodValidation.body(twoFactorCodeSchema),
  handleVerify,
];

/** POST /auth/2fa/resend — always 200; re-requests inside the cooldown are
 * silently dropped in the service (no oracle). */
export const resendTwoFactor = asyncHandler(
  async (req: Request, res: Response) => {
    const pending = await resolvePendingPrincipal(req);
    await resendTwoFactorLogin(pending.kind, pending.id);
    sendSuccess(res, { message: 'A new code is on its way.' });
  },
);

// --- Management (full session required — routed behind authenticate-jwt) ---

/** POST /auth/2fa/challenge — sends the code both enable and disable consume.
 * 400 when the account has neither email nor phone. */
export const challengeTwoFactor = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = requireActor(req);
    await requestTwoFactorChallenge(actor.kind, actor.id);
    sendSuccess(res, { message: 'We sent you a verification code.' });
  },
);

const handleEnable = asyncHandler(async (req: Request, res: Response) => {
  const { code } = req.body as TwoFactorCodeBody;
  const actor = requireActor(req);
  await enableTwoFactorService(actor.kind, actor.id, code);
  sendSuccess(res, { message: 'Two-factor authentication is now on.' });
});

export const enableTwoFactor: RequestHandler[] = [
  ...zodValidation.body(twoFactorCodeSchema),
  handleEnable,
];

const handleDisable = asyncHandler(async (req: Request, res: Response) => {
  const { code } = req.body as TwoFactorCodeBody;
  const actor = requireActor(req);
  await disableTwoFactorService(actor.kind, actor.id, code);
  sendSuccess(res, { message: 'Two-factor authentication is now off.' });
});

export const disableTwoFactor: RequestHandler[] = [
  ...zodValidation.body(twoFactorCodeSchema),
  handleDisable,
];

/** GET /auth/2fa/status — { enabled, channel: 'email' | 'sms' | null }. */
export const twoFactorStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = requireActor(req);
    const status = await getTwoFactorStatus(actor.kind, actor.id);
    sendSuccess(res, {
      data: status,
      message: 'Two-factor status retrieved successfully',
    });
  },
);
