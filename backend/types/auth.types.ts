// types/auth.types.ts
//
// Shapes of the JWT payloads this app signs. Both are minted centrally by the
// auth service's mintAuthTokens; nothing else signs tokens.
import { UserRole } from './user-profile.types.js';

/**
 * Access-token payload — also what authenticate-jwt puts on req.user.
 * `tokenVersion` is the session epoch embedded at issuance; a mismatch with
 * the user's live epoch (after a refresh-theft response) rejects the token.
 */
export interface AccessTokenPayload {
  id: number;
  role: UserRole;
  tokenVersion: number;
}

/**
 * Refresh-token payload. `jti` (standard claim, set via jwt's `jwtid` option)
 * is the rotation id registered server-side at issuance and consumed at
 * exchange, so a refresh token can be rotated at most once. Optional only
 * because a foreign/legacy token may decode without one — the service rejects
 * those.
 */
export interface RefreshTokenPayload {
  id: number;
  jti?: string;
  tokenVersion: number;
}
