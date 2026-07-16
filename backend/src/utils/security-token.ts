// src/utils/security-token.ts
//
// Pure crypto helpers for the persisted security tokens (refresh-token jtis,
// OTP login codes, password-reset link tokens). No I/O — the DB read/write of
// these tokens lives in the auth service. Only the sha256 hash of a token is
// ever stored; the plaintext exists only inside the JWT (or the email/SMS we
// send the user).
import crypto from 'node:crypto';

/**
 * A cryptographically-random 6-digit login code. Uses the full 000000–999999
 * range (zero-padded) — `randomInt`'s upper bound is exclusive, so 1_000_000
 * makes 999999 reachable.
 */
export const generateOtpCode = (): string =>
  crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');

/** A 256-bit opaque token (64 hex chars) for password-reset links. */
export const generateResetToken = (): string =>
  crypto.randomBytes(32).toString('hex');

/** sha256 hex of a plaintext token/jti — what we persist and compare against. */
export const hashSecurityToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');

/**
 * Constant-time comparison of two hex digests. Guards the OTP check against
 * timing side-channels. Different lengths short-circuit to false (and avoid
 * `timingSafeEqual` throwing on mismatched buffer sizes).
 */
export const timingSafeEqualHex = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
};

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
