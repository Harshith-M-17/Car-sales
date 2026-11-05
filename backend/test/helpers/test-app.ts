import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import Redis from 'ioredis';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Connection } from 'mongoose';
import { App } from 'supertest/types';

export interface TestApp {
  app: INestApplication;
  http: App;
  connection: Connection;
  uploadDir: string;
  /** Counts MongoDB commands issued while `fn` runs (N+1 detection). */
  countQueries<T>(fn: () => Promise<T>): Promise<{ result: T; commands: string[] }>;
  close(): Promise<void>;
}

const IGNORED_COMMANDS = new Set([
  'hello',
  'isMaster',
  'ismaster',
  'ping',
  'endSessions',
  'saslStart',
  'saslContinue',
]);

/** Removes only this app's keys (`cs:*`) so a shared Redis DB is never wiped. */
async function clearRedisKeys(url: string) {
  const redis = new Redis(url);
  try {
    let cursor = '0';
    do {
      const [next, keys] = await redis.scan(cursor, 'MATCH', 'cs:*', 'COUNT', 500);
      if (keys.length) await redis.del(...keys);
      cursor = next;
    } while (cursor !== '0');
  } finally {
    redis.disconnect();
  }
}

/**
 * Boots the full app against a throwaway mongod. Set TEST_REDIS_URL (e.g.
 * redis://127.0.0.1:6379/15) to run the same suite with Redis-backed cache,
 * throttling, locks and view counters instead of the in-memory fallbacks.
 */
export async function createTestApp(env: Record<string, string> = {}): Promise<TestApp> {
  const mongo = await MongoMemoryServer.create();
  const redisUrl = process.env.TEST_REDIS_URL ?? '';
  if (redisUrl) await clearRedisKeys(redisUrl);
  const uploadDir = mkdtempSync(join(tmpdir(), 'carsales-uploads-'));

  Object.assign(process.env, {
    NODE_ENV: 'test',
    MONGODB_URI: mongo.getUri('carsales_test'),
    JWT_ACCESS_SECRET: 'test-secret-test-secret-test-secret-0123456789',
    RATE_LIMIT_ENABLED: 'false',
    SWAGGER_ENABLED: 'false',
    STORAGE_DRIVER: 'local',
    LOCAL_UPLOAD_DIR: uploadDir,
    PUBLIC_MEDIA_BASE_URL: 'http://localhost:4000/uploads',
    REDIS_URL: redisUrl,
    LISTING_MODERATION: 'false',
    MONGODB_MONITOR_COMMANDS: 'true',
    ...env,
  });

  // Imported after env is set: config is validated when the module graph loads.
  const { AppModule } = await import('../../src/app.module');
  const { configureApp } = await import('../../src/app.setup');

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ bufferLogs: true });
  configureApp(app);
  await app.init();

  const connection = app.get<Connection>(getConnectionToken());
  // Make sure every index exists before tests (autoIndex builds asynchronously).
  await Promise.all(Object.values(connection.models).map((m) => m.init()));

  let recording: string[] | null = null;
  const client = connection.getClient();
  client.on('commandStarted', (event) => {
    if (recording && !IGNORED_COMMANDS.has(event.commandName)) {
      recording.push(
        `${event.commandName}:${(event.command as Record<string, unknown>)[event.commandName]}`,
      );
    }
  });

  return {
    app,
    http: app.getHttpServer() as App,
    connection,
    uploadDir,
    async countQueries(fn) {
      recording = [];
      try {
        const result = await fn();
        return { result, commands: recording };
      } finally {
        recording = null;
      }
    },
    async close() {
      await app.close();
      await mongo.stop();
      rmSync(uploadDir, { recursive: true, force: true });
    },
  };
}
