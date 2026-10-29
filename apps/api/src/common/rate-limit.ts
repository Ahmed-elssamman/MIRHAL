import { ThrottlerStorage } from '@nestjs/throttler';
import { createHash } from 'node:crypto';
import { Database } from './database';

export { clientTracker, buildRateLimitKey } from '../rate-limit/client-tracker';

/**
 * @deprecated DatabaseRateLimit is deprecated and must not be used in production.
 * Production rate limiting uses distributed Redis (RedisRateLimitStorage).
 * This class is preserved strictly for backward-compatible test assertions.
 */
export class DatabaseRateLimit implements ThrottlerStorage {
  constructor(private readonly db: Pick<Database, '$queryRaw'>) {}

  async increment(key: string, ttl: number, limit: number, blockDuration: number) {
    const hash = createHash('sha256').update(key).digest('hex');
    const now = new Date();
    const timestamp = now.toISOString();
    const expiresAt = new Date(now.getTime() + ttl).toISOString();
    const blockedUntil = new Date(now.getTime() + blockDuration).toISOString();
    const rows = await this.db.$queryRaw<
      { hits: number; expiresAt: Date; blockedUntil: Date | null }[]
    >`INSERT INTO "RateLimitBucket" ("key", "hits", "expiresAt", "blockedUntil")
      VALUES (${hash}, 1, ${expiresAt}::timestamp, NULL)
      ON CONFLICT ("key") DO UPDATE SET
        "hits" = CASE WHEN "RateLimitBucket"."expiresAt" <= ${timestamp}::timestamp
          AND COALESCE("RateLimitBucket"."blockedUntil", ${timestamp}::timestamp) <= ${timestamp}::timestamp
          THEN 1 ELSE "RateLimitBucket"."hits" + 1 END,
        "expiresAt" = CASE WHEN "RateLimitBucket"."expiresAt" <= ${timestamp}::timestamp
          AND COALESCE("RateLimitBucket"."blockedUntil", ${timestamp}::timestamp) <= ${timestamp}::timestamp
          THEN ${expiresAt}::timestamp ELSE "RateLimitBucket"."expiresAt" END,
        "blockedUntil" = CASE
          WHEN "RateLimitBucket"."blockedUntil" > ${timestamp}::timestamp THEN "RateLimitBucket"."blockedUntil"
          WHEN "RateLimitBucket"."expiresAt" <= ${timestamp}::timestamp THEN NULL
          WHEN "RateLimitBucket"."hits" >= ${limit} THEN ${blockedUntil}::timestamp
          ELSE NULL END
      RETURNING "hits", "expiresAt", "blockedUntil"`;
    const row = rows[0];
    if (!row) throw new Error('Rate limit storage unavailable');
    return {
      totalHits: row.hits,
      timeToExpire: Math.max(0, Math.ceil((row.expiresAt.getTime() - now.getTime()) / 1000)),
      isBlocked: Boolean(row.blockedUntil && row.blockedUntil > now),
      timeToBlockExpire: Math.max(
        0,
        Math.ceil(((row.blockedUntil?.getTime() ?? 0) - now.getTime()) / 1000),
      ),
    };
  }
}
