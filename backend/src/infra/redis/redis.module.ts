import { Global, Inject, Injectable, Logger, Module, OnApplicationShutdown } from '@nestjs/common';
import Redis from 'ioredis';
import { APP_CONFIG, AppConfig } from '../../config/app-config';
import { DistributedLockService } from './distributed-lock.service';
import { REDIS, RedisClient } from './redis.constants';

export { REDIS } from './redis.constants';
export type { RedisClient } from './redis.constants';

@Injectable()
class RedisLifecycle implements OnApplicationShutdown {
  constructor(@Inject(REDIS) private readonly redis: RedisClient) {}

  async onApplicationShutdown() {
    if (this.redis && this.redis.status !== 'end') {
      await this.redis.quit().catch(() => this.redis?.disconnect());
    }
  }
}

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig): RedisClient => {
        if (!config.redisUrl) return null;
        const logger = new Logger('Redis');
        const client = new Redis(config.redisUrl, {
          // Fail fast instead of queueing commands forever when Redis is down;
          // callers treat Redis as best-effort and fall back to the database.
          maxRetriesPerRequest: 2,
          enableOfflineQueue: true,
          connectTimeout: 5_000,
          retryStrategy: (times) => Math.min(times * 200, 5_000),
        });
        client.on('error', (err) => logger.warn(`Redis error: ${err.message}`));
        client.on('ready', () => logger.log('Redis connected'));
        return client;
      },
    },
    RedisLifecycle,
    DistributedLockService,
  ],
  exports: [REDIS, DistributedLockService],
})
export class RedisModule {}
