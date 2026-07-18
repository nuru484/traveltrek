// src/utils/authz-cache.ts
//
// Short-TTL cache for the per-request session-epoch read: the principal's
// live tokenVersion. It is consulted on every authenticated request (see
// authenticate-jwt) - uncached it would wake the database constantly.
//
// The cache is REDIS-FIRST so every instance shares one view: a server-side
// epoch bump (refresh-theft response, password change, role change,
// deletion) deletes the shared entry and takes effect on all instances at
// once, not within a per-process TTL. When Redis is unavailable (test runs,
// a Redis hiccup) the module degrades to the previous per-process map with
// the same TTL - correct on one instance, TTL-bounded on many - rather than
// failing requests.
//
// Keys are `kind:id` - customers and staff live in separate tables with
// overlapping numeric ids, so the principal kind is part of the identity.
import type { PrincipalKind } from '#types/auth.types.js';

import { getRedisClient } from '#lib/redis.js';
import logger from '#utils/logger.js';

const TTL_MS = 60_000;
/** Safety valve: tokens for deleted accounts land here as negative entries. */
const MAX_ENTRIES = 1000;

/** Redis stores strings only: a numeric version, or GONE for "account no
 * longer exists" (a negative entry, distinct from a plain cache miss). */
const GONE = 'gone';

interface VersionEntry {
  expiresAt: number;
  /** The principal's current tokenVersion, or null when the account no longer exists. */
  version: null | number;
}

const versionCache = new Map<string, VersionEntry>();

const cacheKey = (kind: PrincipalKind, id: number): string =>
  `authz:v:${kind}:${String(id)}`;

const readMemory = (key: string): null | number | undefined => {
  const entry = versionCache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    versionCache.delete(key);
    return undefined;
  }
  return entry.version;
};

const writeMemory = (key: string, version: null | number): void => {
  if (versionCache.size >= MAX_ENTRIES) versionCache.clear();
  versionCache.set(key, { expiresAt: Date.now() + TTL_MS, version });
};

/** Returns the cached epoch: a number, null (account known to be gone), or
 * undefined on a miss/expiry. */
export const getCachedTokenVersion = async (
  kind: PrincipalKind,
  id: number,
): Promise<null | number | undefined> => {
  const key = cacheKey(kind, id);
  const redis = getRedisClient();
  if (redis) {
    try {
      const raw = await redis.get(key);
      if (raw === null) return undefined;
      if (raw === GONE) return null;
      const version = Number(raw);
      return Number.isNaN(version) ? undefined : version;
    } catch {
      // Redis unreachable: the client's 'error' listener already logged it.
    }
  }
  return readMemory(key);
};

export const setCachedTokenVersion = async (
  kind: PrincipalKind,
  id: number,
  version: null | number,
): Promise<void> => {
  const key = cacheKey(kind, id);
  const redis = getRedisClient();
  if (redis) {
    try {
      await redis.set(
        key,
        version === null ? GONE : String(version),
        'PX',
        TTL_MS,
      );
      return;
    } catch {
      // Fall through to the per-process map.
    }
  }
  writeMemory(key, version);
};

/**
 * Drop a principal's cached session epoch so a logout / epoch bump / role
 * change / deletion applies at once instead of at cache expiry. Synchronous
 * on purpose (nine service call sites treat revocation as a fire-and-forget
 * side effect): the shared-store delete is dispatched and its failure logged,
 * and the local fallback entry always dies immediately.
 */
export const invalidateCachedTokenVersion = (
  kind: PrincipalKind,
  id: number,
): void => {
  const key = cacheKey(kind, id);
  versionCache.delete(key);
  const redis = getRedisClient();
  if (redis) {
    redis.del(key).catch((err: unknown) => {
      // Worst case the shared entry lives out its TTL (60s) - log so a
      // pattern of failures is visible.
      logger.warn(
        { err: err instanceof Error ? err.message : String(err), key },
        'Failed to invalidate shared authz cache entry',
      );
    });
  }
};

/** Test seam. */
export const clearAuthzCaches = (): void => {
  versionCache.clear();
};
