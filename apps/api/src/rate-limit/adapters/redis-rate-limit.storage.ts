import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import Redis from 'ioredis';
import { createHash } from 'node:crypto';
import { RateLimitStorageRecord } from '../rate-limit.types';

@Injectable()
export class RedisRateLimitStorage implements ThrottlerStorage, OnModuleDestroy {
  private readonly logger = new Logger(RedisRateLimitStorage.name);
  private client: Redis | null = null;
  private readonly isReady: Promise<boolean>;

  private static readonly LUA_SCRIPT = `
    local bucket_key = KEYS[1]
    local block_key = KEYS[2]
    local ttl_ms = tonumber(ARGV[1])
    local limit = tonumber(ARGV[2])
    local block_duration_ms = tonumber(ARGV[3])

    -- Increment hits
    local hits = redis.call('INCR', bucket_key)
    if hits == 1 then
      redis.call('PEXPIRE', bucket_key, ttl_ms)
    end

    local pttl = redis.call('PTTL', bucket_key)
    if pttl < 0 then
      pttl = ttl_ms
      redis.call('PEXPIRE', bucket_key, ttl_ms)
    end

    -- Check if already blocked
    local block_pttl = redis.call('PTTL', block_key)
    if block_pttl > 0 then
      return {hits, math.ceil(block_pttl / 1000), 1, math.ceil(block_pttl / 1000)}
    end

    local is_blocked = 0
    local time_to_block = 0
    if hits > limit and block_duration_ms > 0 then
      redis.call('SET', block_key, '1', 'PX', block_duration_ms)
      is_blocked = 1
      time_to_block = math.ceil(block_duration_ms / 1000)
    end

    return {hits, math.max(0, math.ceil(pttl / 1000)), is_blocked, time_to_block}
  `;

  constructor(
    private readonly redisUrl?: string,
    clientInstance?: Redis,
  ) {
    if (clientInstance) {
      this.client = clientInstance;
      this.isReady = Promise.resolve(true);
    } else if (redisUrl) {
      this.client = new Redis(redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: 2,
        connectTimeout: 5000,
        enableAutoPipelining: true,
        retryStrategy: (times) => (times > 3 ? null : Math.min(times * 100, 1000)),
      });
      this.isReady = this.client
        .connect()
        .then(() => true)
        .catch((err) => {
          this.logger.error('Failed to connect to Redis', err);
          return false;
        });
    } else {
      this.isReady = Promise.resolve(false);
    }
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    _throttlerName?: string,
  ): Promise<RateLimitStorageRecord> {
    if (!this.client) {
      throw new Error('Redis client is not configured for distributed rate limiting.');
    }

    const ready = await this.isReady;
    if (!ready && this.client.status !== 'ready' && this.client.status !== 'connecting') {
      throw new Error('Redis rate limit storage is currently unavailable.');
    }

    const hashedKey = `lq:rl:${createHash('sha256').update(key).digest('hex')}`;
    const blockKey = `${hashedKey}:blocked`;

    try {
      const result = (await this.client.eval(
        RedisRateLimitStorage.LUA_SCRIPT,
        2,
        hashedKey,
        blockKey,
        ttl,
        limit,
        blockDuration,
      )) as [number, number, number, number];

      const [totalHits, timeToExpire, isBlockedNum, timeToBlockExpire] = result;

      return {
        totalHits: Number(totalHits),
        timeToExpire: Math.max(0, Number(timeToExpire)),
        isBlocked: Number(isBlockedNum) === 1,
        timeToBlockExpire: Math.max(0, Number(timeToBlockExpire)),
      };
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          level: 'error',
          code: 'RATE_LIMIT_REDIS_ERROR',
          message: error instanceof Error ? error.message : 'Unknown Redis error',
        }),
      );
      throw error;
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      try {
        await this.client.quit();
      } catch {
        this.client.disconnect();
      }
      this.client = null;
    }
  }
}
