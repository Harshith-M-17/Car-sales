import { randomUUID } from 'node:crypto';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { LoggerModule } from 'nestjs-pino';
import { APP_CONFIG, AppConfig } from './config/app-config';
import { AppConfigModule } from './config/config.module';
import { CacheModule } from './infra/cache/cache.module';
import { REDIS, RedisClient, RedisModule } from './infra/redis/redis.module';
import { isInternalRequest, UserThrottlerGuard } from './infra/throttle/user-throttler.guard';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard, RolesGuard } from './modules/auth/guards';
import { CatalogModule } from './modules/catalog/catalog.module';
import { FavoritesModule } from './modules/favorites/favorites.module';
import { HealthModule } from './modules/health/health.module';
import { LeadsModule } from './modules/leads/leads.module';
import { ListingsModule } from './modules/listings/listings.module';
import { MediaModule } from './modules/media/media.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    AppConfigModule,
    LoggerModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        pinoHttp: {
          level: config.env === 'test' ? 'silent' : config.isProduction ? 'info' : 'debug',
          transport:
            config.env === 'development'
              ? {
                  target: 'pino-pretty',
                  options: { singleLine: true, translateTime: 'SYS:HH:MM:ss' },
                }
              : undefined,
          genReqId: (req, res) => {
            const incoming = req.headers['x-request-id'];
            const id =
              typeof incoming === 'string' && /^[\w-]{1,128}$/.test(incoming)
                ? incoming
                : randomUUID();
            res.setHeader('x-request-id', id);
            return id;
          },
          redact: ['req.headers.authorization'],
          autoLogging: { ignore: (req) => req.url?.startsWith('/api/health') ?? false },
          customLogLevel: (_req, res, err) =>
            err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
          serializers: {
            req: (req: { id: unknown; method: string; url: string }) => ({
              id: req.id,
              method: req.method,
              url: req.url,
            }),
            res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
          },
        },
      }),
    }),
    MongooseModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        uri: config.mongo.uri,
        maxPoolSize: config.mongo.maxPoolSize,
        minPoolSize: Math.min(5, config.mongo.maxPoolSize),
        serverSelectionTimeoutMS: 10_000,
        socketTimeoutMS: 45_000,
        autoIndex: config.mongo.autoIndex,
        monitorCommands: config.mongo.monitorCommands,
        appName: 'carsales-api',
      }),
    }),
    RedisModule,
    CacheModule,
    ThrottlerModule.forRootAsync({
      inject: [APP_CONFIG, REDIS],
      useFactory: (config: AppConfig, redis: RedisClient) => ({
        // Generous default: Indian mobile carriers put many users behind one CGNAT IP.
        // Sensitive routes (auth, uploads, leads) set much stricter per-route limits.
        throttlers: [{ name: 'default', ttl: 60_000, limit: 300 }],
        skipIf: (context) =>
          !config.rateLimitEnabled ||
          isInternalRequest(context.switchToHttp().getRequest(), config.internalApiKey),
        // Shared counters across instances when Redis is available; in-memory otherwise.
        storage: redis ? new ThrottlerStorageRedisService(redis) : undefined,
      }),
    }),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot({ wildcard: false, ignoreErrors: false }),
    HealthModule,
    CatalogModule,
    UsersModule,
    AuthModule,
    MediaModule,
    ListingsModule,
    FavoritesModule,
    LeadsModule,
    AdminModule,
  ],
  providers: [
    // Order matters: authenticate first so the throttler can key by user id.
    { provide: APP_GUARD, useExisting: JwtAuthGuard },
    { provide: APP_GUARD, useClass: UserThrottlerGuard },
    { provide: APP_GUARD, useExisting: RolesGuard },
  ],
})
export class AppModule {}
