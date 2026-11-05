import * as Joi from 'joi';

export const APP_CONFIG = Symbol('APP_CONFIG');

export type NodeEnv = 'development' | 'production' | 'test';
export type StorageDriverName = 'local' | 's3';
export type MailDriverName = 'log' | 'smtp';

export interface AppConfig {
  env: NodeEnv;
  isProduction: boolean;
  port: number;
  trustProxy: number;
  corsOrigins: string[];
  swaggerEnabled: boolean;
  rateLimitEnabled: boolean;
  /** Sent by the website's server so its requests skip the rate limit. */
  internalApiKey: string | null;
  mongo: {
    uri: string;
    maxPoolSize: number;
    autoIndex: boolean;
    monitorCommands: boolean;
  };
  redisUrl: string | null;
  auth: {
    accessSecret: string;
    accessTtlSeconds: number;
    refreshTtlDays: number;
  };
  listings: {
    moderation: boolean;
    ttlDays: number;
    maxImages: number;
  };
  defaultPhoneRegion: string;
  /** Public address of the website, used for links in emails. */
  webAppUrl: string;
  mail: {
    driver: MailDriverName;
    appName: string;
    from: string;
    smtp: {
      host: string;
      port: number;
      secure: boolean;
      user: string | undefined;
      pass: string | undefined;
    };
  };
  storage: {
    driver: StorageDriverName;
    localDir: string;
    publicBaseUrl: string;
    s3: {
      bucket: string;
      region: string;
      endpoint: string | undefined;
      accessKeyId: string | undefined;
      secretAccessKey: string | undefined;
    };
  };
}

const schema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().port().default(4000),
  TRUST_PROXY: Joi.number().integer().min(0).default(0),
  CORS_ORIGINS: Joi.string().default('http://localhost:3100'),
  SWAGGER_ENABLED: Joi.boolean().default(true),
  RATE_LIMIT_ENABLED: Joi.boolean().default(true),
  INTERNAL_API_KEY: Joi.string().min(32).allow('').default(''),

  MONGODB_URI: Joi.string()
    .uri({ scheme: ['mongodb', 'mongodb+srv'] })
    .required(),
  MONGODB_MAX_POOL_SIZE: Joi.number().integer().min(1).max(500).default(50),
  MONGODB_AUTO_INDEX: Joi.boolean().default(true),
  MONGODB_MONITOR_COMMANDS: Joi.boolean().default(false),

  REDIS_URL: Joi.string()
    .uri({ scheme: ['redis', 'rediss'] })
    .allow('')
    .default(''),

  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_TTL_SECONDS: Joi.number().integer().min(60).max(86400).default(900),
  REFRESH_TOKEN_TTL_DAYS: Joi.number().integer().min(1).max(365).default(30),

  LISTING_MODERATION: Joi.boolean().default(false),
  LISTING_TTL_DAYS: Joi.number().integer().min(1).max(365).default(60),
  MAX_IMAGES_PER_LISTING: Joi.number().integer().min(1).max(50).default(20),
  DEFAULT_PHONE_REGION: Joi.string().length(2).uppercase().default('IN'),

  WEB_APP_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .default('http://localhost:3100'),
  MAIL_DRIVER: Joi.string().valid('log', 'smtp').default('log'),
  MAIL_APP_NAME: Joi.string().default('CarBazaar'),
  MAIL_FROM: Joi.string().allow('').when('MAIL_DRIVER', {
    is: 'smtp',
    then: Joi.string().required(),
    otherwise: Joi.optional(),
  }),
  SMTP_HOST: Joi.string().allow('').when('MAIL_DRIVER', {
    is: 'smtp',
    then: Joi.string().required(),
    otherwise: Joi.optional(),
  }),
  SMTP_PORT: Joi.number().port().default(587),
  SMTP_SECURE: Joi.boolean().default(false),
  SMTP_USER: Joi.string().allow('').optional(),
  SMTP_PASS: Joi.string().allow('').optional(),

  STORAGE_DRIVER: Joi.string().valid('local', 's3').default('local'),
  LOCAL_UPLOAD_DIR: Joi.string().default('uploads'),
  PUBLIC_MEDIA_BASE_URL: Joi.string().uri().default('http://localhost:4000/uploads'),
  S3_BUCKET: Joi.string().allow('').when('STORAGE_DRIVER', {
    is: 's3',
    then: Joi.string().required(),
    otherwise: Joi.optional(),
  }),
  S3_REGION: Joi.string().default('ap-south-1'),
  S3_ENDPOINT: Joi.string().uri().allow('').optional(),
  S3_ACCESS_KEY_ID: Joi.string().allow('').optional(),
  S3_SECRET_ACCESS_KEY: Joi.string().allow('').optional(),
})
  .custom((value: Record<string, unknown>, helpers) => {
    if (value.NODE_ENV === 'production') {
      // The log driver would put password reset links in the logs and never reach users.
      if (value.MAIL_DRIVER === 'log') {
        return helpers.message({ custom: 'MAIL_DRIVER=log is not allowed in production' });
      }
      if (/\/\/(localhost|127\.0\.0\.1)\b/.test(String(value.WEB_APP_URL))) {
        return helpers.message({ custom: 'WEB_APP_URL must be the public site in production' });
      }
    }
    return value;
  })
  .unknown(true);

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const { value, error } = schema.validate(env, { abortEarly: false, convert: true });
  if (error) {
    const details = error.details.map((d) => `  - ${d.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  const v = value as Record<string, any>;
  const nodeEnv = v.NODE_ENV as NodeEnv;

  return {
    env: nodeEnv,
    isProduction: nodeEnv === 'production',
    port: v.PORT,
    trustProxy: v.TRUST_PROXY,
    corsOrigins: String(v.CORS_ORIGINS)
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    swaggerEnabled: v.SWAGGER_ENABLED,
    rateLimitEnabled: v.RATE_LIMIT_ENABLED,
    internalApiKey: v.INTERNAL_API_KEY || null,
    mongo: {
      uri: v.MONGODB_URI,
      maxPoolSize: v.MONGODB_MAX_POOL_SIZE,
      autoIndex: v.MONGODB_AUTO_INDEX,
      monitorCommands: v.MONGODB_MONITOR_COMMANDS,
    },
    redisUrl: v.REDIS_URL || null,
    auth: {
      accessSecret: v.JWT_ACCESS_SECRET,
      accessTtlSeconds: v.JWT_ACCESS_TTL_SECONDS,
      refreshTtlDays: v.REFRESH_TOKEN_TTL_DAYS,
    },
    listings: {
      moderation: v.LISTING_MODERATION,
      ttlDays: v.LISTING_TTL_DAYS,
      maxImages: v.MAX_IMAGES_PER_LISTING,
    },
    defaultPhoneRegion: v.DEFAULT_PHONE_REGION,
    webAppUrl: String(v.WEB_APP_URL).replace(/\/+$/, ''),
    mail: {
      driver: v.MAIL_DRIVER,
      appName: v.MAIL_APP_NAME,
      from: v.MAIL_FROM ?? '',
      smtp: {
        host: v.SMTP_HOST ?? '',
        port: v.SMTP_PORT,
        secure: v.SMTP_SECURE,
        user: v.SMTP_USER || undefined,
        pass: v.SMTP_PASS || undefined,
      },
    },
    storage: {
      driver: v.STORAGE_DRIVER,
      localDir: v.LOCAL_UPLOAD_DIR,
      publicBaseUrl: String(v.PUBLIC_MEDIA_BASE_URL).replace(/\/+$/, ''),
      s3: {
        bucket: v.S3_BUCKET ?? '',
        region: v.S3_REGION,
        endpoint: v.S3_ENDPOINT || undefined,
        accessKeyId: v.S3_ACCESS_KEY_ID || undefined,
        secretAccessKey: v.S3_SECRET_ACCESS_KEY || undefined,
      },
    },
  };
}
