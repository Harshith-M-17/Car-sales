import { resolve } from 'node:path';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { Logger } from 'nestjs-pino';
import { APP_CONFIG, AppConfig } from './config/app-config';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

// Drop unknown filter keys instead of passing them to MongoDB.
mongoose.set('strictQuery', true);

/** Shared HTTP setup for the real server and e2e tests, so tests exercise production wiring. */
export function configureApp(app: NestExpressApplication): AppConfig {
  const config = app.get<AppConfig>(APP_CONFIG);

  app.useLogger(app.get(Logger));
  app.set('trust proxy', config.trustProxy);
  app.disable('x-powered-by');

  app.use(
    helmet({
      // Images are loaded cross-origin by the web app.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      // Swagger UI ships inline scripts; the API itself only serves JSON.
      contentSecurityPolicy: config.swaggerEnabled ? false : undefined,
    }),
  );
  app.use(compression({ threshold: 1024 }));
  app.useBodyParser('json', { limit: '200kb' });
  app.enableCors({
    origin: config.corsOrigins,
    maxAge: 86_400,
    exposedHeaders: ['x-request-id'],
  });

  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  if (config.storage.driver === 'local') {
    app.useStaticAssets(resolve(config.storage.localDir), {
      prefix: '/uploads/',
      maxAge: '365d',
      immutable: true,
      index: false,
      dotfiles: 'deny',
    });
  }

  if (config.swaggerEnabled) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Car Sales API')
        .setDescription(
          'Used-car marketplace: sellers list cars, buyers discover and contact them.',
        )
        .setVersion('1.0')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup('api/docs', app, document);
  }

  app.enableShutdownHooks();
  return config;
}
