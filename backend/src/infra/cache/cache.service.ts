import { Inject, Injectable, Logger } from '@nestjs/common';
import { REDIS, RedisClient } from '../redis/redis.constants';
import { MemoryStore } from './memory-store';

const PREFIX = 'cs:cache:';

/**
 * JSON cache backed by Redis when available, otherwise a bounded in-process store.
 * Cache failures never fail a request: reads fall through to the loader.
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly memory = new MemoryStore();
  private readonly inflight = new Map<string, Promise<unknown>>();

  constructor(@Inject(REDIS) private readonly redis: RedisClient) {}

  async get<T>(key: string): Promise<T | undefined> {
    const raw = await this.rawGet(PREFIX + key);
    if (raw === undefined) return undefined;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return undefined;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    const raw = JSON.stringify(value);
    if (!this.redis) return this.memory.set(PREFIX + key, raw, ttlSeconds);
    try {
      await this.redis.set(PREFIX + key, raw, 'EX', ttlSeconds);
    } catch (err) {
      this.warn('set', err);
    }
  }

  async del(...keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    if (!this.redis) {
      keys.forEach((k) => this.memory.delete(PREFIX + k));
      return;
    }
    try {
      await this.redis.del(...keys.map((k) => PREFIX + k));
    } catch (err) {
      this.warn('del', err);
    }
  }

  /**
   * Read-through cache with in-process single-flight: concurrent misses for the
   * same key share one loader call instead of stampeding the database.
   */
  async wrap<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== undefined) return cached;

    const pending = this.inflight.get(key) as Promise<T> | undefined;
    if (pending) return pending;

    const promise = (async () => {
      try {
        const value = await loader();
        if (value !== undefined) await this.set(key, value, ttlSeconds);
        return value;
      } finally {
        this.inflight.delete(key);
      }
    })();
    this.inflight.set(key, promise);
    return promise;
  }

  private async rawGet(key: string): Promise<string | undefined> {
    if (!this.redis) return this.memory.get(key);
    try {
      return (await this.redis.get(key)) ?? undefined;
    } catch (err) {
      this.warn('get', err);
      return undefined;
    }
  }

  private warn(op: string, err: unknown) {
    this.logger.warn(`cache ${op} failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}
