import { Controller, Get, Inject, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorService,
  MongooseHealthIndicator,
} from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/auth.decorators';
import { REDIS, RedisClient } from '../../infra/redis/redis.constants';

@ApiTags('health')
@Public()
@SkipThrottle()
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly mongoose: MongooseHealthIndicator,
    private readonly indicators: HealthIndicatorService,
    @Inject(REDIS) private readonly redis: RedisClient,
  ) {}

  /** Liveness: the process is up. Never touches dependencies. */
  @Get('live')
  live() {
    return { status: 'ok' };
  }

  /** Readiness: dependencies reachable; load balancers should route traffic only when 200. */
  @Get('ready')
  @HealthCheck()
  ready() {
    return this.health.check([
      () => this.mongoose.pingCheck('mongodb', { timeout: 3_000 }),
      async () => {
        const indicator = this.indicators.check('redis');
        if (!this.redis) return indicator.up({ mode: 'disabled' });
        try {
          await this.redis.ping();
          return indicator.up();
        } catch (err) {
          return indicator.down({ message: err instanceof Error ? err.message : 'unreachable' });
        }
      },
    ]);
  }
}
