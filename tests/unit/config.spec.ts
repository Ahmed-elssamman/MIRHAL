import { describe, expect, it } from 'vitest';
import {
  validateEnvironment,
  StartupConfigurationError,
} from '../../apps/api/src/common/config/env.schema';

describe('Configuration Architecture', () => {
  const baseValidEnv = {
    NODE_ENV: 'development',
    DATABASE_URL: 'postgresql://postgres:secret@localhost:5432/mirhal_dev',
    DIRECT_URL: 'postgresql://postgres:secret@localhost:5432/mirhal_dev',
    PORT: '3333',
    WEB_ORIGIN: 'http://localhost:4200',
    ADMIN_ORIGIN: 'http://localhost:4201',
    APP_URL: 'http://localhost:4200',
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
      BLOB_READ_WRITE_TOKEN: 'mock-token-for-test',
      MAIL_MODE: 'disabled',
    };
    expect(() => validateEnvironment(prodEnv)).not.toThrow();

    expect(() =>
      validateEnvironment({
        ...prodEnv,
        WEB_ORIGIN: 'http://insecure.mirhal.com',
      }),
    ).toThrow(/WEB_ORIGIN must be an HTTPS origin/);
  });

  it('requires REDIS_URL in production when RATE_LIMIT_MODE is redis', () => {
    const prodEnv = {
      ...baseValidEnv,
      NODE_ENV: 'production',
      WEB_ORIGIN: 'https://app.mirhal.com',
      ADMIN_ORIGIN: 'https://admin.mirhal.com',
      APP_URL: 'https://app.mirhal.com',
      BLOB_READ_WRITE_TOKEN: 'mock-token-for-test',
      MAIL_MODE: 'disabled',
      RATE_LIMIT_MODE: 'redis',
    };
    expect(() => validateEnvironment(prodEnv)).toThrow(/REDIS_URL to be configured/);
  });
});
