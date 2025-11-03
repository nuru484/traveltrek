// src/config/redisConnection.ts
import ENV from './env';

export function createRedisConnection() {
  const isTLS = ENV.REDIS_URL.startsWith('rediss://');

  return {
    url: ENV.REDIS_URL,
    ...(isTLS ? { tls: {} } : {}),
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };
}
