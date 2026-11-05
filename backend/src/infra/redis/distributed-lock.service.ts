import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { REDIS, RedisClient } from './redis.constants';

// Delete the lock only if we still own it.
const RELEASE_SCRIPT = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`;

/**
 * Ensures scheduled jobs run on one instance at a time when the API is scaled out.
 * Without Redis (single instance) the job simply runs.
 */
@Injectable()
export class DistributedLockService {
  private readonly logger = new Logger(DistributedLockService.name);

  constructor(@Inject(REDIS) private readonly redis: RedisClient) {}

  async runExclusive(name: string, ttlMs: number, job: () => Promise<void>): Promise<boolean> {
    if (!this.redis) {
      await job();
      return true;
    }
    const key = `cs:lock:${name}`;
    const token = randomUUID();
    let acquired: string | null;
    try {
      acquired = await this.redis.set(key, token, 'PX', ttlMs, 'NX');
    } catch (err) {
      this.logger.warn(`lock ${name} unavailable: ${(err as Error).message}`);
      return false;
    }
    if (!acquired) return false;
    try {
      await job();
      return true;
    } finally {
      await this.redis.eval(RELEASE_SCRIPT, 1, key, token).catch(() => undefined);
    }
  }
}
