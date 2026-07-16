// src/config/redisConnection.ts
import ENV from '#config/env.js';

export function createRedisConnection() {
  const isTLS = ENV.REDIS_URL.startsWith('rediss://');

  return {
    url: ENV.REDIS_URL,
    ...(isTLS ? { tls: {} } : {}),
    enableReadyCheck: false,
    maxRetriesPerRequest: null,
  };
}
