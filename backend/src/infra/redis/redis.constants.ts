import type Redis from 'ioredis';

/** Redis client, or `null` when REDIS_URL is not configured (single-instance mode). */
export const REDIS = Symbol('REDIS');
export type RedisClient = Redis | null;
