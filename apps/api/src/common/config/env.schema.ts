import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3333),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DIRECT_URL: z.string().optional(),
  TEST_DATABASE_URL: z.string().optional(),
  WEB_ORIGIN: z.string().default('http://localhost:4200'),
  ADMIN_ORIGIN: z.string().default('http://localhost:4201'),
  APP_URL: z.string().default('http://localhost:4200'),
  VERCEL: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  TRUSTED_PROXIES: z.string().optional(),
  MAIL_MODE: z.enum(['development', 'disabled', 'production']).default('development'),
  EMAIL_PROVIDER: z.enum(['file', 'smtp', 'resend', 'memory']).optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(465),
  SMTP_SECURE: z.enum(['true', 'false']).default('true'),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  SUPPORT_EMAIL: z.union([z.string().email(), z.literal('')]).optional(),
  RESEND_API_KEY: z.string().optional(),
  REDIS_URL: z.string().optional(),
  RATE_LIMIT_MODE: z.enum(['auto', 'redis', 'memory']).default('auto'),
});

export type EnvConfig = z.infer<typeof envSchema>;

export class StartupConfigurationError extends Error {}

/**
 * Validates the startup environment using Zod and production readiness rules.
 * Throws exact, descriptive errors to guarantee early failure on bad configuration.
 */
export function validateEnvironment(env: Record<string, unknown> = process.env): EnvConfig {
  const isProd = env['NODE_ENV'] === 'production';
  const isVercel = env['VERCEL'] === '1';

  // Check required base variables
  const required = ['DATABASE_URL'];
  if (!isVercel) required.push('DIRECT_URL');
  if (isProd) required.push('WEB_ORIGIN', 'ADMIN_ORIGIN', 'APP_URL');

  const missing = required.filter((name) => !env[name]);
  if (missing.length > 0) {
    throw new StartupConfigurationError(
      `Missing required environment variables: ${missing.join(', ')}`,
    );
  }

  // Parse with Zod
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const portIssue = parsed.error.issues.find((i) => i.path.includes('PORT'));
    if (portIssue) {
      throw new StartupConfigurationError('PORT must be a valid TCP port.');
    }
    const firstIssue = parsed.error.issues[0];
    throw new StartupConfigurationError(
      `Configuration error in ${firstIssue?.path.join('.') ?? 'environment'}: ${firstIssue?.message ?? 'invalid'}`,
    );
  }

  const config = parsed.data;

  // Validate production-specific requirements
  if (isProd) {
    for (const name of ['WEB_ORIGIN', 'ADMIN_ORIGIN', 'APP_URL'] as const) {
      try {
        const val = String(env[name] ?? '');
        const url = new URL(val);
        if (url.protocol !== 'https:' || url.origin !== val) {
          throw new Error('Invalid origin');
        }
      } catch {
        throw new StartupConfigurationError(
          `${name} must be an HTTPS origin without a path, query, or credentials.`,
        );
      }
    }

    if (config.MAIL_MODE !== 'disabled') {
      const provider = config.EMAIL_PROVIDER;
      const fields: (keyof EnvConfig)[] =
        provider === 'smtp'
          ? ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM']
          : provider === 'resend'
            ? ['RESEND_API_KEY', 'SMTP_FROM']
            : [];
      if (!fields.length || fields.some((name) => !config[name])) {
        throw new StartupConfigurationError(
          'Production email provider configuration is incomplete.',
        );
      }
    }

    // Production rate limiting: Redis is strictly required for production
    if (config.RATE_LIMIT_MODE === 'redis' && !config.REDIS_URL) {
      throw new StartupConfigurationError(
        'Production rate limiting requires REDIS_URL to be configured.',
      );
    }
  }

  return config;
}
