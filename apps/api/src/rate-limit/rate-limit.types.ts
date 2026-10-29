import { ThrottlerStorage } from '@nestjs/throttler';

export const RATE_LIMIT_STORAGE = 'RATE_LIMIT_STORAGE';

export interface RateLimitStorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

export type RateLimiterStorage = ThrottlerStorage;

export interface TierConfig {
  ttl: number; // in milliseconds
  limit: number;
  blockDuration?: number; // in milliseconds
}

export const RATE_LIMIT_TIERS: Record<string, TierConfig> = {
  default: { ttl: 60000, limit: 180 },
  login: { ttl: 60000, limit: 10, blockDuration: 60000 },
  register: { ttl: 60000, limit: 5, blockDuration: 60000 },
  forgotPassword: { ttl: 60000, limit: 5, blockDuration: 60000 },
  resetPassword: { ttl: 60000, limit: 5, blockDuration: 60000 },
  verifyEmail: { ttl: 60000, limit: 10, blockDuration: 60000 },
  uploads: { ttl: 60000, limit: 20 },
  adminMutations: { ttl: 60000, limit: 30 },
  publicEndpoints: { ttl: 60000, limit: 60 },
  authenticatedReads: { ttl: 60000, limit: 180 },
};
