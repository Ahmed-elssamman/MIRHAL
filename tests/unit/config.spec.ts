import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import {
  validateEnvironment,
  StartupConfigurationError,
} from '../../apps/api/src/common/config/env.schema';

describe('Configuration Architecture', () => {
  it('declares production Redis as an owner-provided Render environment variable', () => {
    const blueprint = parse(readFileSync('render.yaml', 'utf8')) as {
      services: {
        branch: string;
        autoDeployTrigger: string;
        envVars: { key: string; sync?: boolean }[];
      }[];
    };
    expect(blueprint.services[0]?.branch).toBe('main');
    expect(blueprint.services[0]?.autoDeployTrigger).toBe('commit');
    expect(blueprint.services[0]?.envVars).toContainEqual({ key: 'REDIS_URL', sync: false });
    expect(blueprint.services[0]?.envVars).toContainEqual({
      key: 'RATE_LIMIT_MODE',
      value: 'redis',
    });
  });
  const baseValidEnv = {
    NODE_ENV: 'development',
    DATABASE_URL: 'postgresql://postgres:secret@localhost:5432/mirhal_dev',
    DIRECT_URL: 'postgresql://postgres:secret@localhost:5432/mirhal_dev',
    PORT: '3333',
    WEB_ORIGIN: 'http://localhost:4200',
    ADMIN_ORIGIN: 'http://localhost:4201',
    APP_URL: 'http://localhost:4200',
    EMAIL_PROVIDER: 'smtp',
    SMTP_HOST: 'smtp.example.test',
    SMTP_USER: 'user@example.test',
    SMTP_PASSWORD: 'test-only-password',
    SMTP_FROM: 'MIRHAL <no-reply@example.test>',
  };

  it('validates a correct development configuration', () => {
    const config = validateEnvironment(baseValidEnv);
    expect(config.PORT).toBe(3333);
    expect(config.NODE_ENV).toBe('development');
    expect(config.DATABASE_URL).toContain('mirhal_dev');
  });

  it('fails early if DATABASE_URL is missing', () => {
    const invalid = { ...baseValidEnv, DATABASE_URL: '' };
    expect(() => validateEnvironment(invalid)).toThrow(StartupConfigurationError);
    expect(() => validateEnvironment(invalid)).toThrow(/Missing required environment variables/);
  });

  it('fails early if DIRECT_URL is missing outside Vercel', () => {
    const invalid = { ...baseValidEnv, DIRECT_URL: '' };
    expect(() => validateEnvironment(invalid)).toThrow(/DIRECT_URL/);
  });

  it('allows missing DIRECT_URL inside Vercel environment', () => {
    const vercelEnv = { ...baseValidEnv, VERCEL: '1', DIRECT_URL: '' };
    const config = validateEnvironment(vercelEnv);
    expect(config.VERCEL).toBe('1');
  });

  it('validates port range bounds', () => {
    expect(() => validateEnvironment({ ...baseValidEnv, PORT: '0' })).toThrow(/PORT/);
    expect(() => validateEnvironment({ ...baseValidEnv, PORT: '70000' })).toThrow(/PORT/);
    expect(() => validateEnvironment({ ...baseValidEnv, PORT: 'abc' })).toThrow(/PORT/);
  });

  it('enforces HTTPS origins in production', () => {
    const prodEnv = {
      ...baseValidEnv,
      NODE_ENV: 'production',
      WEB_ORIGIN: 'https://app.mirhal.com',
      ADMIN_ORIGIN: 'https://admin.mirhal.com',
      APP_URL: 'https://app.mirhal.com',
      REDIS_URL: 'redis://localhost:6379',
    };
    expect(() => validateEnvironment(prodEnv)).not.toThrow();

    expect(() =>
      validateEnvironment({
        ...prodEnv,
        WEB_ORIGIN: 'http://insecure.mirhal.com',
      }),
    ).toThrow(/WEB_ORIGIN must be an HTTPS origin/);
  });

  it('requires REDIS_URL in production even when RATE_LIMIT_MODE is auto', () => {
    const prodEnv = {
      ...baseValidEnv,
      NODE_ENV: 'production',
      WEB_ORIGIN: 'https://app.mirhal.com',
      ADMIN_ORIGIN: 'https://admin.mirhal.com',
      APP_URL: 'https://app.mirhal.com',
      RATE_LIMIT_MODE: 'auto',
    };
    expect(() => validateEnvironment(prodEnv)).toThrow(/REDIS_URL to be configured/);
  });

  it('rejects invalid Redis URLs and production memory rate limiting', () => {
    const prodEnv = {
      ...baseValidEnv,
      NODE_ENV: 'production',
      WEB_ORIGIN: 'https://app.mirhal.example',
      ADMIN_ORIGIN: 'https://admin.mirhal.example',
      APP_URL: 'https://app.mirhal.example',
      REDIS_URL: 'redis://localhost:6379',
    };
    expect(() => validateEnvironment({ ...prodEnv, REDIS_URL: 'https://redis.example' })).toThrow(
      /REDIS_URL must be a valid redis:\/\/ or rediss:\/\/ URL/,
    );
    expect(() => validateEnvironment({ ...prodEnv, RATE_LIMIT_MODE: 'memory' })).toThrow(
      /not allowed in production/,
    );
  });

  it('accepts the Render production email mode and rejects the old invalid enabled value', () => {
    const prodEnv = {
      ...baseValidEnv,
      NODE_ENV: 'production',
      WEB_ORIGIN: 'https://app.mirhal.example',
      ADMIN_ORIGIN: 'https://admin.mirhal.example',
      APP_URL: 'https://app.mirhal.example',
      MAIL_MODE: 'production',
      EMAIL_PROVIDER: 'resend',
      RESEND_API_KEY: 'mock-key-for-test',
      SMTP_FROM: 'MIRHAL <mail@mirhal.example>',
      SUPPORT_EMAIL: 'support@mirhal.example',
      REDIS_URL: 'redis://localhost:6379',
    };
    expect(validateEnvironment(prodEnv).MAIL_MODE).toBe('production');
    expect(validateEnvironment(prodEnv).SUPPORT_EMAIL).toBe('support@mirhal.example');
    expect(() => validateEnvironment({ ...prodEnv, MAIL_MODE: 'enabled' })).toThrow(/MAIL_MODE/);
  });

  it('allows disabled email delivery in production without provider credentials', () => {
    const config = validateEnvironment({
      ...baseValidEnv,
      NODE_ENV: 'production',
      WEB_ORIGIN: 'https://app.mirhal.example',
      ADMIN_ORIGIN: 'https://admin.mirhal.example',
      APP_URL: 'https://app.mirhal.example',
      REDIS_URL: 'redis://localhost:6379',
      MAIL_MODE: 'disabled',
      EMAIL_PROVIDER: undefined,
      SMTP_HOST: undefined,
      SMTP_USER: undefined,
      SMTP_PASSWORD: undefined,
      SMTP_FROM: undefined,
    });
    expect(config.MAIL_MODE).toBe('disabled');
  });
});
