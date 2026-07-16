// types/auth.types.ts
//
// Shapes of the JWT payloads this app signs. Both are minted centrally by the
// auth service's mintAuthTokens; nothing else signs tokens.
import { UserRole } from './user-profile.types.js';

/**
 * Access-token payload — also what authenticate-jwt puts on req.user.
 * `tokenVersion` is the session epoch embedded at issuance; a mismatch with
 * the principal's live epoch (after a refresh-theft response) rejects the
 * token. Customers always carry role CUSTOMER, so the existing
 * authorizeRole([UserRole.CUSTOMER, ...]) route gates keep working verbatim.
 */
export interface AccessTokenPayload {
  id: number;
  kind: PrincipalKind;
  role: UserRole;
  tokenVersion: number;
}

/**
 * Which principal table a session belongs to (Phase 5b): customers and staff
 * live in separate tables with overlapping numeric ids, so every token names
 * its table explicitly and every lookup (tokenVersion, refresh registration)
 * resolves against the right one.
 */
export type PrincipalKind = 'customer' | 'staff';

/**
 * Refresh-token payload. `jti` (standard claim, set via jwt's `jwtid` option)
 * is the rotation id registered server-side at issuance and consumed at
 * exchange, so a refresh token can be rotated at most once. Optional only
 * because a foreign/legacy token may decode without one — the service rejects
 * those. `kind` is likewise checked on exchange (a pre-split token without it
 * is rejected).
 */
export interface RefreshTokenPayload {
  id: number;
  jti?: string;
  kind?: PrincipalKind;
  tokenVersion: number;
}
