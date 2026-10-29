import { Injectable } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { RateLimitStorageRecord } from '../rate-limit.types';

interface BucketEntry {
  hits: number;
  expiresAt: number;
  blockedUntil: number | null;
}

@Injectable()
export class InMemoryRateLimitStorage implements ThrottlerStorage {
  private readonly buckets = new Map<string, BucketEntry>();

  constructor() {
    if (process.env['NODE_ENV'] === 'production') {
      throw new Error(
        'In-memory rate limiting is strictly prohibited in production. A distributed Redis store is required.',
      );
    }
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    _throttlerName?: string,
  ): Promise<RateLimitStorageRecord> {
    const now = Date.now();
    let entry = this.buckets.get(key);

    // If entry doesn't exist or expired, reset
    if (!entry || entry.expiresAt <= now) {
      entry = {
        hits: 1,
        expiresAt: now + ttl,
        blockedUntil: null,
      };
      this.buckets.set(key, entry);
      return {
        totalHits: 1,
        timeToExpire: Math.max(0, Math.ceil(ttl / 1000)),
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    }

    // Increment hits on each request
    entry.hits += 1;

    // Check if currently blocked
    const wasBlocked = Boolean(entry.blockedUntil && entry.blockedUntil > now);
    if (wasBlocked) {
      return {
        totalHits: entry.hits,
        timeToExpire: Math.max(0, Math.ceil((entry.expiresAt - now) / 1000)),
        isBlocked: true,
        timeToBlockExpire: Math.max(0, Math.ceil(((entry.blockedUntil ?? now) - now) / 1000)),
      };
    }

    // Check if new hit triggers block
    if (entry.hits > limit && blockDuration > 0) {
      entry.blockedUntil = now + blockDuration;
    }

    const isBlocked = Boolean(entry.blockedUntil && entry.blockedUntil > now);
    const timeToBlockExpire = isBlocked
      ? Math.max(0, Math.ceil(((entry.blockedUntil ?? now) - now) / 1000))
      : 0;

    return {
      totalHits: entry.hits,
      timeToExpire: Math.max(0, Math.ceil((entry.expiresAt - now) / 1000)),
      isBlocked,
      timeToBlockExpire,
    };
  }

  reset() {
    this.buckets.clear();
  }
}
