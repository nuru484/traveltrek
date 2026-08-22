// src/utils/two-factor-pending.ts
//
// The short-lived "password verified, awaiting 2FA code" proof, over both
// principals. After a correct password on a
// 2FA-enabled account we don't issue a session — the login controller sets a
// signed, httpOnly, 10-minute pending cookie carrying this token instead. It
// proves the password step so /auth/2fa/verify and /auth/2fa/resend know
// which principal is mid-login, without granting any access.
//
// SECURITY: it is signed with a key DERIVED from ACCESS_TOKEN_SECRET but
// domain-separated by a label, so a pending token can never be replayed as an
// access token — it simply won't verify in authenticate-jwt. Cryptographic
// separation, not a claim check, closes the 2FA-bypass door; the
// `purpose: '2fa'` claim is a secondary sanity check on top.
import jwt from 'jsonwebtoken';

import type { PrincipalKind } from '#types/auth.types.js';

import ENV from '#config/env.js';
import { UnauthorizedError } from '#middlewares/error-handler.js';
import { verifyJwtToken } from '#utils/verify-jwt-token.js';

/** Matches the TWO_FACTOR code TTL in the auth service — the pending proof
 * and the code it waits on expire together. */
export const TWO_FACTOR_PENDING_TTL_MINUTES = 10;

const PENDING_PURPOSE = '2fa';

// Cryptographically independent of ACCESS_TOKEN_SECRET (a token signed with
// one can't be verified with the other), derived so no extra env var is
// required. The label provides the domain separation.
const pendingSecret = (): string =>
  `${ENV.ACCESS_TOKEN_SECRET}::two-factor-pending`;

/** The mid-login principal a pending token vouches for. */
export interface TwoFactorPendingPrincipal {
  id: number;
  kind: PrincipalKind;
}

interface PendingPayload extends TwoFactorPendingPrincipal {
  purpose?: string;
}

export const signTwoFactorPendingToken = (
  principal: TwoFactorPendingPrincipal,
): string =>
  jwt.sign(
    { id: principal.id, kind: principal.kind, purpose: PENDING_PURPOSE },
    pendingSecret(),
    // Seconds (avoids a stringly-typed expiresIn); matches the code lifetime.
    { expiresIn: TWO_FACTOR_PENDING_TTL_MINUTES * 60 },
  );

const isPrincipalKind = (value: unknown): value is PrincipalKind =>
  value === 'customer' || value === 'staff';

/** Verifies a pending-2FA token and returns the principal it vouches for.
 * Every failure mode collapses into one uniform 401. */
export const verifyTwoFactorPendingToken = async (
  token: string,
): Promise<TwoFactorPendingPrincipal> => {
  const invalid = (): UnauthorizedError =>
    new UnauthorizedError('Your login session expired. Please sign in again.', {
      code: 'INVALID_2FA_SESSION',
      layer: 'auth',
    });

  let decoded: PendingPayload;
  try {
    decoded = await verifyJwtToken<PendingPayload>(token, pendingSecret());
  } catch {
    throw invalid();
  }

  if (
    decoded.purpose !== PENDING_PURPOSE ||
    typeof decoded.id !== 'number' ||
    !isPrincipalKind(decoded.kind)
  ) {
    throw invalid();
  }
  return { id: decoded.id, kind: decoded.kind };
};
