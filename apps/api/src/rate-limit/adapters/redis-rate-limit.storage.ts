import { Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { createHash } from 'node:crypto';
import { RateLimiterStorage, RateLimitStorageRecord } from '../rate-limit.types';

const UNAVAILABLE_MESSAGE = 'Distributed rate limit storage is unavailable.';
const STARTUP_CONNECTION_TIMEOUT_MS = 8_000;

export class RedisRateLimitStorage implements RateLimiterStorage, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisRateLimitStorage.name);
  private readonly client: Redis | null;
  private connectionErrorLogged = false;

  private static readonly LUA_SCRIPT = `
    local bucket_key = KEYS[1]
    local block_key = KEYS[2]
    local ttl_ms = tonumber(ARGV[1])
    local limit = tonumber(ARGV[2])
    local block_duration_ms = tonumber(ARGV[3])

    local hits = redis.call('INCR', bucket_key)
    if hits == 1 then
      redis.call('PEXPIRE', bucket_key, ttl_ms)
    end

    local ttl = redis.call('PTTL', bucket_key)
    if ttl < 0 then
      ttl = ttl_ms
      redis.call('PEXPIRE', bucket_key, ttl_ms)
    end

    local block_ttl = redis.call('PTTL', block_key)
    if block_ttl > 0 then
      return {hits, math.ceil(ttl / 1000), 1, math.ceil(block_ttl / 1000)}
    end

    if hits > limit and block_duration_ms > 0 then
      redis.call('SET', block_key, '1', 'PX', block_duration_ms)
      return {hits, math.ceil(ttl / 1000), 1, math.ceil(block_duration_ms / 1000)}
    end

    return {hits, math.ceil(ttl / 1000), 0, 0}
  `;

  constructor(
    redisUrl?: string,
    private readonly keyPrefix = 'lq:rl:',
    clientInstance?: Redis,
  ) {
    if (clientInstance) {
      this.client = clientInstance;
    } else if (redisUrl) {
      try {
        this.client = new Redis(redisUrl, {
          lazyConnect: true,
          connectTimeout: 3000,
          commandTimeout: 1000,
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false,
          retryStrategy: (times) => Math.min(times * 100, 1000),
        });
      } catch {
        this.client = null;
      }
    } else {
      this.client = null;
    }

    this.client?.on('error', (error: Error) => this.logConnectionError(error));
    this.client?.on('ready', () => {
      this.connectionErrorLogged = false;
    });
  }

  async onModuleInit(): Promise<void> {
    if (!this.client) {
      throw new Error('Production rate limiting requires a valid Redis connection.');
    }

    try {
      if (this.client.status === 'wait') {
        let timeout: ReturnType<typeof setTimeout> | undefined;
        try {
          await Promise.race([
            this.client.connect(),
            new Promise<never>((_, reject) => {
              timeout = setTimeout(() => {
                this.client?.disconnect();
                reject(new Error('Redis startup connection timed out.'));
              }, STARTUP_CONNECTION_TIMEOUT_MS);
              timeout.unref();
            }),
          ]);
        } finally {
          if (timeout) clearTimeout(timeout);
        }
      }
      if (this.client.status !== 'ready') throw new Error('Redis is not ready.');
      await this.client.ping();
    } catch (error) {
      this.logConnectionError(error);
      this.client.disconnect();
      throw new Error('Production rate limiting could not connect to Redis.');
    }
  }

  async isReady(): Promise<boolean> {
    if (!this.client || this.client.status !== 'ready') return false;
    try {
      await this.client.ping();
      return true;
    } catch (error) {
      this.logConnectionError(error);
      return false;
    }
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    _throttlerName?: string,
  ): Promise<RateLimitStorageRecord> {
    if (!this.client || this.client.status !== 'ready') {
      throw new Error(UNAVAILABLE_MESSAGE);
    }

    const digest = createHash('sha256').update(key).digest('hex');
    const bucketKey = `${this.keyPrefix}{${digest}}`;
    const blockKey = `${bucketKey}:blocked`;

    try {
      const result = (await this.client.eval(
        RedisRateLimitStorage.LUA_SCRIPT,
        2,
        bucketKey,
        blockKey,
        Math.max(1, ttl),
        Math.max(1, limit),
        Math.max(0, blockDuration),
      )) as [number, number, number, number];

      return {
        totalHits: Number(result[0]),
        timeToExpire: Math.max(0, Number(result[1])),
        isBlocked: Number(result[2]) === 1,
        timeToBlockExpire: Math.max(0, Number(result[3])),
      };
    } catch {
      throw new Error(UNAVAILABLE_MESSAGE);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.client) return;
    if (this.client.status === 'ready') {
      try {
        await this.client.quit();
        return;
      } catch {
        // Force-close a connection that cannot complete the graceful QUIT.
      }
    }
    this.client.disconnect();
  }

  private logConnectionError(error: unknown): void {
    if (this.connectionErrorLogged) return;
    this.connectionErrorLogged = true;
    const code =
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof error.code === 'string'
        ? error.code
        : undefined;
    this.logger.error(
      JSON.stringify({
        event: 'rate_limit_redis_unavailable',
        ...(code ? { errorCode: code } : {}),
      }),
    );
  }
}
