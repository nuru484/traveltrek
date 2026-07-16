// src/utils/security-token.ts
//
// Pure crypto helpers for the persisted security tokens (refresh-token jtis
// today; OTP codes and password-reset links in the next phase). No I/O — the
// DB read/write of these tokens lives in the auth service. Only the sha256
// hash of a token is ever stored; the plaintext exists only inside the JWT
// (or, later, the email we send the user).
import crypto from 'node:crypto';

/** sha256 hex of a plaintext token/jti — what we persist and compare against. */
export const hashSecurityToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');

/**
 * Milliseconds for a jwt-style expiry string ("45s", "30m", "12h", "7d").
 * Falls back when the string is unparseable so a config typo can't produce
 * refresh-token rows that never expire (or expire instantly).
 */
export const parseExpiryMs = (expiry: string, fallbackMs: number): number => {
  const match = /^(\d+)([smhd])$/.exec(expiry.trim());
  if (!match) return fallbackMs;
  const value = Number(match[1]);
  const unit = { d: 86_400_000, h: 3_600_000, m: 60_000, s: 1_000 }[
    match[2] as 'd' | 'h' | 'm' | 's'
  ];
  return value * unit;
};
