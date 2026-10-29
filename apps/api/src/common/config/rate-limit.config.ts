import { registerAs } from '@nestjs/config';

export interface RateLimitConfig {
  mode: 'auto' | 'redis' | 'memory';
  redisUrl?: string;
  keyPrefix: string;
  defaultTtlMs: number;
  defaultLimit: number;
  tiers: {
    login: { ttl: number; limit: number };
    register: { ttl: number; limit: number };
    forgotPassword: { ttl: number; limit: number };
    resetPassword: { ttl: number; limit: number };
    verifyEmail: { ttl: number; limit: number };
    uploads: { ttl: number; limit: number };
    adminMutations: { ttl: number; limit: number };
    publicEndpoints: { ttl: number; limit: number };
    authenticatedReads: { ttl: number; limit: number };
  };
}

export const rateLimitConfig = registerAs('rateLimit', (): RateLimitConfig => {
  const isProd = process.env['NODE_ENV'] === 'production';
  const mode = (process.env['RATE_LIMIT_MODE'] ?? (isProd ? 'redis' : 'auto')) as
    'auto' | 'redis' | 'memory';

  return {
    mode,
    redisUrl: process.env['REDIS_URL'],
    keyPrefix: 'lq:rl:',
    defaultTtlMs: 60 * 1000,
    defaultLimit: 180,
    tiers: {
      login: { ttl: 60 * 1000, limit: 10 },
      register: { ttl: 60 * 1000, limit: 5 },
      forgotPassword: { ttl: 60 * 1000, limit: 5 },
      resetPassword: { ttl: 60 * 1000, limit: 5 },
      verifyEmail: { ttl: 60 * 1000, limit: 10 },
      uploads: { ttl: 60 * 1000, limit: 20 },
      adminMutations: { ttl: 60 * 1000, limit: 30 },
      publicEndpoints: { ttl: 60 * 1000, limit: 60 },
      authenticatedReads: { ttl: 60 * 1000, limit: 180 },
    },
  };
});
