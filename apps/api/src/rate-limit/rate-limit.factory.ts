import type { RateLimitConfig } from '../common/config/rate-limit.config';
import { InMemoryRateLimitStorage } from './adapters/in-memory-rate-limit.storage';
import { RedisRateLimitStorage } from './adapters/redis-rate-limit.storage';
import type { RateLimiterStorage } from './rate-limit.types';

export function createRateLimitStorage(
  config: RateLimitConfig,
  isProduction: boolean,
): RateLimiterStorage {
  if (isProduction) {
    if (config.mode === 'memory') {
      throw new Error('In-memory rate limiting is not allowed in production.');
    }
    if (!config.redisUrl) {
      throw new Error('Production rate limiting requires REDIS_URL to be configured.');
    }
    return new RedisRateLimitStorage(config.redisUrl, config.keyPrefix);
  }

  if (config.mode === 'redis' || (config.mode === 'auto' && config.redisUrl)) {
    if (!config.redisUrl) throw new Error('RATE_LIMIT_MODE=redis requires REDIS_URL.');
    return new RedisRateLimitStorage(config.redisUrl, config.keyPrefix);
  }

  return new InMemoryRateLimitStorage();
}
