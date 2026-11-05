import { existsSync } from 'node:fs';
import { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';

/** Boots the DI container (no HTTP server) for one-off operational scripts. */
export async function runScript(name: string, fn: (app: INestApplicationContext) => Promise<void>) {
  if (existsSync('.env')) process.loadEnvFile('.env');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    await fn(app);
  } catch (err) {
    console.error(`[${name}] failed:`, err instanceof Error ? err.message : err);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}
