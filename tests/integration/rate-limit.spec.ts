import { describe, expect, it, vi } from 'vitest';
import { Request } from 'express';
import { InMemoryRateLimitStorage } from '../../apps/api/src/rate-limit/adapters/in-memory-rate-limit.storage';
import { RedisRateLimitStorage } from '../../apps/api/src/rate-limit/adapters/redis-rate-limit.storage';
import { clientTracker, buildRateLimitKey } from '../../apps/api/src/rate-limit/client-tracker';
import { ApiRequest } from '../../apps/api/src/common/http';

describe('Rate Limiting Architecture (Database Independent)', () => {
  describe('InMemoryRateLimitStorage', () => {
    it('enforces hit limits and blocks after threshold is exceeded', async () => {
      const storage = new InMemoryRateLimitStorage();
      const key = 'test-client-1';

      // 3 allowed hits with limit 3
      const r1 = await storage.increment(key, 60000, 3, 30000);
      expect(r1.totalHits).toBe(1);
      expect(r1.isBlocked).toBe(false);

      const r2 = await storage.increment(key, 60000, 3, 30000);
      expect(r2.totalHits).toBe(2);
      expect(r2.isBlocked).toBe(false);

      const r3 = await storage.increment(key, 60000, 3, 30000);
      expect(r3.totalHits).toBe(3);
      expect(r3.isBlocked).toBe(false);

      // 4th hit exceeds limit -> blocked
      const r4 = await storage.increment(key, 60000, 3, 30000);
      expect(r4.totalHits).toBe(4);
      expect(r4.isBlocked).toBe(true);
      expect(r4.timeToBlockExpire).toBeGreaterThan(0);
    });

    it('resets counters after TTL expiration', async () => {
      const storage = new InMemoryRateLimitStorage();
      const key = 'test-ttl-client';

      await storage.increment(key, 10, 2, 10);
      // Wait for TTL (15ms)
      await new Promise((r) => setTimeout(r, 20));

      const after = await storage.increment(key, 10, 2, 10);
      expect(after.totalHits).toBe(1);
      expect(after.isBlocked).toBe(false);
    });

    it('handles concurrent requests safely', async () => {
      const storage = new InMemoryRateLimitStorage();
      const key = 'test-concurrent-client';

      const results = await Promise.all(
        Array.from({ length: 10 }, () => storage.increment(key, 60000, 5, 60000)),
      );

      const hitNumbers = results.map((r) => r.totalHits).sort((a, b) => a - b);
      expect(hitNumbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      expect(results.filter((r) => !r.isBlocked).length).toBe(5);
    });

    it('shares simulated multi-instance storage without database', async () => {
      // In-memory simulates two app instances sharing a store
      const storage = new InMemoryRateLimitStorage();
      const key = 'test-multi-instance';

      const instanceA = storage;
      const instanceB = storage;

      await instanceA.increment(key, 60000, 2, 60000);
      const resB = await instanceB.increment(key, 60000, 2, 60000);
      expect(resB.totalHits).toBe(2);

      const resA2 = await instanceA.increment(key, 60000, 2, 60000);
      expect(resA2.totalHits).toBe(3);
      expect(resA2.isBlocked).toBe(true);
    });
  });

  describe('Client Tracker & Proxy Behavior', () => {
    it('uses direct IP when not on trusted Vercel proxy', () => {
      const req = {
        ip: '127.0.0.1',
        headers: { 'x-vercel-forwarded-for': '203.0.113.195' },
      } as unknown as Request;

      expect(clientTracker(req)).toBe('127.0.0.1');
    });

    it('trusts edge forwarded header only when VERCEL is enabled', () => {
      vi.stubEnv('VERCEL', '1');
      try {
        const req = {
          ip: '127.0.0.1',
          headers: { 'x-vercel-forwarded-for': '203.0.113.195, 10.0.0.1' },
        } as unknown as Request;

        expect(clientTracker(req)).toBe('203.0.113.195');

        // Invalid IP in header falls back to request.ip
        const invalidReq = {
          ip: '127.0.0.1',
          headers: { 'x-vercel-forwarded-for': 'malicious-string' },
        } as unknown as Request;

        expect(clientTracker(invalidReq)).toBe('127.0.0.1');
      } finally {
        vi.unstubAllEnvs();
      }
    });

    it('builds composite key with user identity and route', () => {
      const req = {
        ip: '198.51.100.5',
        headers: {},
        method: 'POST',
        path: '/api/auth/login',
        identity: { id: 'usr_123', sessionId: 'ses_456' },
      } as unknown as ApiRequest;

      const key = buildRateLimitKey(req);
      expect(key).toBe('198.51.100.5:u:usr_123:s:ses_456:POST:/api/auth/login');
    });
  });

  describe('RedisRateLimitStorage', () => {
    it('throws when Redis client is not initialized or fails', async () => {
      const storage = new RedisRateLimitStorage();
      await expect(storage.increment('k', 60000, 5, 60000)).rejects.toThrow(/not configured/);
    });

    it('calls eval script atomically on Redis client', async () => {
      const mockEval = vi.fn().mockResolvedValue([2, 59, 0, 0]);
      const mockClient = {
        eval: mockEval,
        status: 'ready',
        quit: vi.fn(),
        disconnect: vi.fn(),
      } as unknown as import('ioredis').default;

      const storage = new RedisRateLimitStorage(undefined, mockClient);
      const res = await storage.increment('user-login-key', 60000, 5, 60000);

      expect(mockEval).toHaveBeenCalledOnce();
      expect(res.totalHits).toBe(2);
      expect(res.timeToExpire).toBe(59);
      expect(res.isBlocked).toBe(false);
    });
  });
});
