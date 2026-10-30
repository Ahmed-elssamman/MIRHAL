import { describe, expect, it, vi } from 'vitest';
import { Database } from '../../apps/api/src/common/database';
import { OutboxWorker } from '../../apps/api/src/notifications/outbox/outbox.worker';
import { MailAdapter } from '../../apps/api/src/auth/mail.adapter';

describe('outbox worker claims', () => {
  it('dispatches a job only once when two workers read it concurrently', async () => {
    let status = 'PENDING';
    const job = {
      id: 'job',
      status,
      channel: 'EMAIL',
      eventType: 'VERIFY',
      payload: JSON.stringify({
        to: 'recipient@example.test',
        purpose: 'VERIFY_EMAIL',
        token: 'test-token',
      }),
      attemptCount: 0,
      maxAttempts: 3,
    };
    const db = {
      outboxJob: {
        findMany: vi.fn().mockResolvedValue([job]),
        updateMany: vi.fn().mockImplementation(() => {
          if (status !== 'PENDING') return Promise.resolve({ count: 0 });
          status = 'PROCESSING';
          return Promise.resolve({ count: 1 });
        }),
        update: vi.fn().mockResolvedValue({}),
      },
    };
    const mail = { send: vi.fn().mockResolvedValue(undefined) };
    const first = new OutboxWorker(db as unknown as Database, mail as unknown as MailAdapter);
    const second = new OutboxWorker(db as unknown as Database, mail as unknown as MailAdapter);
    const results = await Promise.all([first.processBatch(), second.processBatch()]);
    expect(mail.send).toHaveBeenCalledTimes(1);
    expect(results.reduce((sum, result) => sum + result.processed, 0)).toBe(1);
  });
});
