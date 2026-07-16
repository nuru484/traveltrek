// src/utils/authz-cache.ts
//
// Short-TTL in-memory cache for the per-request session-epoch read: the
// principal's live tokenVersion. It is consulted on every authenticated
// request (see authenticate-jwt) — uncached it would wake the database
// constantly. Server-side epoch bumps (refresh-token reuse detection)
// invalidate their entry immediately, so revocation is instant on this
// instance and applies within the TTL elsewhere. Single-process deployment; a
// multi-instance future needs a shared store or invalidation broadcast.
//
// Keys are `kind:id` — customers and staff live in separate tables with
// overlapping numeric ids, so the principal kind is part of the identity.
import type { PrincipalKind } from '#types/auth.types.js';

const TTL_MS = 60_000;
/** Safety valve: tokens for deleted accounts land here as negative entries. */
const MAX_ENTRIES = 1000;

interface VersionEntry {
  expiresAt: number;
  /** The principal's current tokenVersion, or null when the account no longer exists. */
  version: null | number;
}

const versionCache = new Map<string, VersionEntry>();

const cacheKey = (kind: PrincipalKind, id: number): string =>
  `${kind}:${String(id)}`;

/** Returns the cached epoch: a number, null (account known to be gone), or
 * undefined on a miss/expiry. */
export const getCachedTokenVersion = (
  kind: PrincipalKind,
  id: number,
): null | number | undefined => {
  const key = cacheKey(kind, id);
  const entry = versionCache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    versionCache.delete(key);
    return undefined;
  }
  return entry.version;
};

export const setCachedTokenVersion = (
  kind: PrincipalKind,
  id: number,
  version: null | number,
): void => {
  if (versionCache.size >= MAX_ENTRIES) versionCache.clear();
  versionCache.set(cacheKey(kind, id), {
    expiresAt: Date.now() + TTL_MS,
    version,
  });
};

/** Drop a principal's cached session epoch so a logout / epoch bump / role
 * change / deletion applies at once instead of at cache expiry. */
export const invalidateCachedTokenVersion = (
  kind: PrincipalKind,
  id: number,
): void => {
  versionCache.delete(cacheKey(kind, id));
};

/** Test seam. */
export const clearAuthzCaches = (): void => {
  versionCache.clear();
};
