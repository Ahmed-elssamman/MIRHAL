import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import Redis from 'ioredis';
import { createHash, randomUUID } from 'node:crypto';
import { RedisRateLimitStorage } from '../../apps/api/src/rate-limit/adapters/redis-rate-limit.storage';

const redisUrl = process.env['TEST_REDIS_URL'];
const redisDescribe = redisUrl ? describe : describe.skip;

redisDescribe('RedisRateLimitStorage (real Redis)', () => {
  let first: RedisRateLimitStorage;
  let second: RedisRateLimitStorage;
  let inspector: Redis;

  beforeAll(async () => {
    first = new RedisRateLimitStorage(redisUrl);
    second = new RedisRateLimitStorage(redisUrl);
    inspector = new Redis(redisUrl, { lazyConnect: true, connectTimeout: 3000 });
    await Promise.all([first.onModuleInit(), second.onModuleInit(), inspector.connect()]);
  });

  afterAll(async () => {
    await Promise.all([first?.onModuleDestroy(), second?.onModuleDestroy()]);
    if (inspector?.status === 'ready') await inspector.quit();
    else inspector?.disconnect();
  });

  it('connects and reports readiness', async () => {
    expect(await first.isReady()).toBe(true);
  });

  it('atomically shares concurrent limits across independent clients', async () => {
    const key = `concurrent:${randomUUID()}`;
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        (index % 2 === 0 ? first : second).increment(key, 60_000, 10, 60_000),
      ),
    );

    expect(results.map((result) => result.totalHits).sort((a, b) => a - b)).toEqual(
      Array.from({ length: 20 }, (_, index) => index + 1),
    );
    expect(results.filter((result) => !result.isBlocked)).toHaveLength(10);
    expect(results.filter((result) => result.isBlocked)).toHaveLength(10);
  });

  it('assigns TTLs and resets the counter after expiration', async () => {
    const key = `expiry:${randomUUID()}`;
    const bucketKey = `lq:rl:{${createHash('sha256').update(key).digest('hex')}}`;

    expect((await first.increment(key, 250, 3, 0)).totalHits).toBe(1);
    expect(await inspector.pttl(bucketKey)).toBeGreaterThan(0);
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect((await second.increment(key, 250, 3, 0)).totalHits).toBe(1);
  });

  it('isolates counters by hashed key and applies block expiration', async () => {
    const firstKey = `policy-a:${randomUUID()}`;
    const secondKey = `policy-b:${randomUUID()}`;
    const blocked = await first.increment(firstKey, 60_000, 1, 5_000);
    const exceeded = await second.increment(firstKey, 60_000, 1, 5_000);
    const isolated = await second.increment(secondKey, 60_000, 1, 5_000);

    expect(blocked.isBlocked).toBe(false);
    expect(exceeded.isBlocked).toBe(true);
    expect(exceeded.timeToBlockExpire).toBeGreaterThan(0);
    expect(isolated.totalHits).toBe(1);
    expect(isolated.isBlocked).toBe(false);
  });
});
