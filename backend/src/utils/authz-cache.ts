// src/utils/authz-cache.ts
//
// Short-TTL in-memory cache for the per-request session-epoch read: the
// user's live tokenVersion. It is consulted on every authenticated request
// (see authenticate-jwt) — uncached it would wake the database constantly.
// Server-side epoch bumps (refresh-token reuse detection) invalidate their
// entry immediately, so revocation is instant on this instance and applies
// within the TTL elsewhere. Single-process deployment; a multi-instance
// future needs a shared store or invalidation broadcast.

const TTL_MS = 60_000;
/** Safety valve: tokens for deleted accounts land here as negative entries. */
const MAX_ENTRIES = 1000;

interface VersionEntry {
  expiresAt: number;
  /** The user's current tokenVersion, or null when the account no longer exists. */
  version: null | number;
}

const versionCache = new Map<number, VersionEntry>();

/** Returns the cached epoch: a number, null (account known to be gone), or
 * undefined on a miss/expiry. */
export const getCachedTokenVersion = (
  userId: number,
): null | number | undefined => {
  const entry = versionCache.get(userId);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    versionCache.delete(userId);
    return undefined;
  }
  return entry.version;
};

export const setCachedTokenVersion = (
  userId: number,
  version: null | number,
): void => {
  if (versionCache.size >= MAX_ENTRIES) versionCache.clear();
  versionCache.set(userId, { expiresAt: Date.now() + TTL_MS, version });
};

/** Drop a user's cached session epoch so a logout / epoch bump / role change /
 * deletion applies at once instead of at cache expiry. */
export const invalidateCachedTokenVersion = (userId: number): void => {
  versionCache.delete(userId);
};

/** Test seam. */
export const clearAuthzCaches = (): void => {
  versionCache.clear();
};
