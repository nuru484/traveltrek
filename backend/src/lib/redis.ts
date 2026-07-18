// src/lib/redis.ts
//
// One shared ioredis client for app-level state that must be visible to every
// instance: rate-limit counters and the authz (tokenVersion) cache. BullMQ
// keeps its own connections (config/redisConnection.ts) - this client is for
// plain commands only.
//
// Failure posture: fail fast, degrade gracefully. enableOfflineQueue:false
// makes every command reject immediately while Redis is unreachable, so
// callers fall back (rate limiter to its memory store at boot, authz cache to
// its in-process map) instead of stalling requests behind a retry queue.
// Tests never open a connection: getRedisClient() returns null under
// NODE_ENV=test and callers treat that as "no Redis".
import { Redis } from 'ioredis';

import ENV from '#config/env.js';
import logger from '#utils/logger.js';

let client: null | Redis | undefined;

/** Graceful-shutdown hook: QUIT politely, force-disconnect if that fails. */
export async function closeRedisClient(): Promise<void> {
  if (!client) {
    client = undefined;
    return;
  }
  const current = client;
  client = undefined;
  try {
    await current.quit();
  } catch {
    current.disconnect();
  }
}

export function getRedisClient(): null | Redis {
  if (client !== undefined) return client;
  if (ENV.NODE_ENV === 'test') {
    client = null;
    return client;
  }

  // rediss:// URLs enable TLS automatically in ioredis.
  client = new Redis(ENV.REDIS_URL, {
    enableOfflineQueue: false,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });
  client.on('error', (err: Error) => {
    // One line per hiccup; commands themselves reject and callers fall back.
    logger.warn({ err: err.message }, 'Shared Redis client error');
  });
  // Kick off the connection in the background; failures surface via 'error'
  // and ioredis keeps reconnecting on its own.
  client.connect().catch(() => undefined);
  return client;
}
