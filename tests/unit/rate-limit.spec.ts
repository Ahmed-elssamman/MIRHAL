import { describe, expect, it } from 'vitest';
import type { RateLimitConfig } from '../../apps/api/src/common/config/rate-limit.config';
import { createRateLimitStorage } from '../../apps/api/src/rate-limit/rate-limit.factory';
import { InMemoryRateLimitStorage } from '../../apps/api/src/rate-limit/adapters/in-memory-rate-limit.storage';
import { RedisRateLimitStorage } from '../../apps/api/src/rate-limit/adapters/redis-rate-limit.storage';

const config = (overrides: Partial<RateLimitConfig> = {}): RateLimitConfig => ({
  mode: 'auto',
  redisUrl: undefined,
  keyPrefix: 'lq:rl:',
  defaultTtlMs: 60_000,
  defaultLimit: 180,
  tiers: {
    login: { ttl: 60_000, limit: 10 },
    register: { ttl: 60_000, limit: 5 },
    forgotPassword: { ttl: 60_000, limit: 5 },
    resetPassword: { ttl: 60_000, limit: 5 },
    verifyEmail: { ttl: 60_000, limit: 10 },
    uploads: { ttl: 60_000, limit: 20 },
    adminMutations: { ttl: 60_000, limit: 30 },
    publicEndpoints: { ttl: 60_000, limit: 60 },
    authenticatedReads: { ttl: 60_000, limit: 180 },
  },
  ...overrides,
});

describe('rate-limit storage selection', () => {
  it('uses Redis in production even when mode is auto', () => {
    expect(
      createRateLimitStorage(config({ redisUrl: 'redis://localhost:6379' }), true),
    ).toBeInstanceOf(RedisRateLimitStorage);
  });

  it('fails closed in production when Redis is missing', () => {
    expect(() => createRateLimitStorage(config(), true)).toThrow(/requires REDIS_URL/);
  });

  it('never selects in-memory storage in production', () => {
    expect(() =>
      createRateLimitStorage(config({ mode: 'memory', redisUrl: 'redis://localhost:6379' }), true),
    ).toThrow(/not allowed in production/);
  });

  it('uses in-memory storage for development auto mode without Redis', () => {
    expect(createRateLimitStorage(config(), false)).toBeInstanceOf(InMemoryRateLimitStorage);
  });

  it('uses Redis for development when explicitly configured', () => {
    expect(
      createRateLimitStorage(config({ mode: 'redis', redisUrl: 'redis://localhost:6379' }), false),
    ).toBeInstanceOf(RedisRateLimitStorage);
  });

  it('fails clearly when Redis mode has no URL outside production', () => {
    expect(() => createRateLimitStorage(config({ mode: 'redis' }), false)).toThrow(
      /RATE_LIMIT_MODE=redis requires REDIS_URL/,
    );
  });
});
