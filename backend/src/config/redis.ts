import { NextFunction, Request, Response } from 'express';
// src/config/redis.ts
import Redis from 'ioredis';

import ENV from '../config/env';
import logger from '../utils/logger';

// Factory function to create and configure Redis client
const redisClient = () => {
  const redisUrl = process.env.REDIS_URL ?? ENV.REDIS_URL;

  const client = new Redis(redisUrl);

  client.on('connect', () => {
    logger.info('Redis connected');
  });

  client.on('error', (err) => {
    logger.error('Redis connection error:', err);
  });

  return client;
};

const client = redisClient();

type KeyGeneratorFn = (req: Request) => string;

// Middleware for caching
const cacheMiddleware =
  (keyGenerator: KeyGeneratorFn) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const cacheKey = keyGenerator(req);

      const data = await client.get(cacheKey);
      if (data) {
        logger.info('Cache hit');

        void client.expire(cacheKey, 3600); // Extend TTL on access (fire-and-forget)

        return res.status(200).json({
          ...JSON.parse(data),
        });
      }

      logger.info('Cache miss');
      next();
    } catch (err) {
      if (err instanceof Error) {
        logger.error(err, 'Error accessing Redis');
      } else {
        logger.error({ err }, 'Error accessing Redis');
      }
      next();
    }
  };

const saveToCache = (key: string, value: unknown, ttl = 3600): void => {
  void client.setex(key, ttl, JSON.stringify(value));
};

const invalidateCache = async (client: Redis, patterns: string | string[]) => {
  const patternArray = Array.isArray(patterns) ? patterns : [patterns];
  const allKeys = new Set<string>();

  // Scan for each pattern
  await Promise.all(
    patternArray.map(async (pattern) => {
      try {
        const stream = client.scanStream({
          count: 100,
          match: pattern,
        });

        stream.on('data', (keys: string[]) => {
          keys.forEach((key) => allKeys.add(key));
        });

        await new Promise<void>((resolve, reject) => {
          stream.on('end', () => {
            resolve();
          });
          stream.on('error', (error) => {
            reject(error);
          });
        });
      } catch (error) {
        console.error(`Error scanning pattern ${pattern}:`, error);
        throw error;
      }
    }),
  );

  // If we found any keys, delete them all at once
  if (allKeys.size > 0) {
    const keysArray = Array.from(allKeys);
    try {
      return await client.del(...keysArray);
    } catch (error) {
      console.error('Error deleting keys:', error);
      throw error;
    }
  }

  return 0;
};

export { cacheMiddleware, client, invalidateCache, saveToCache };
