import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NestFactory } from '@nestjs/core';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../apps/api/src/app.module';
import { configureApp } from '../../apps/api/src/bootstrap';
import { Database } from '../../apps/api/src/common/database';
import { OutboxService } from '../../apps/api/src/notifications/outbox/outbox.service';
import { OutboxWorker } from '../../apps/api/src/notifications/outbox/outbox.worker';
import { randomUUID } from 'node:crypto';

let app: INestApplication;
let db: Database;
let outboxService: OutboxService;
let outboxWorker: OutboxWorker;

beforeAll(async () => {
  app = configureApp(
    await NestFactory.create(AppModule, { logger: false, bodyParser: false, abortOnError: false }),
  );
  await app.init();
  db = app.get(Database);
  outboxService = app.get(OutboxService);
  outboxWorker = app.get(OutboxWorker);
});

afterAll(async () => {
  await app?.close();
});

describe('Transactional Outbox Architecture', () => {
  it('schedules a background job atomically with idempotency key', async () => {
    const idempotencyKey = randomUUID();
    const job1 = await outboxService.schedule(db, {
      channel: 'IN_APP',
      eventType: 'SYSTEM_ALERT',
      payload: { message: 'hello' },
      idempotencyKey,
    });

    expect(job1.id).toBeDefined();
    expect(job1.status).toBe('PENDING');

    // Rescheduling with the exact same idempotencyKey is a safe no-op
    const job2 = await outboxService.schedule(db, {
      channel: 'IN_APP',
      eventType: 'SYSTEM_ALERT',
      payload: { message: 'hello' },
      idempotencyKey,
    });

    expect(job2.id).toBe(job1.id);
  });

  it('processes pending outbox jobs and updates status to COMPLETED', async () => {
    const idempotencyKey = randomUUID();
    // Create an in-app test notification job
    await outboxService.schedule(db, {
      channel: 'IN_APP',
      eventType: 'TEST_JOB',
      payload: [], // Empty notification array succeeds cleanly
      idempotencyKey,
    });

    const result = await outboxWorker.processBatch(10);
    expect(result.processed).toBeGreaterThanOrEqual(1);

    const record = await db.outboxJob.findUnique({ where: { idempotencyKey } });
    expect(record?.status).toBe('COMPLETED');
    expect(record?.processedAt).not.toBeNull();
  });

  it('schedules retries with exponential backoff on failure', async () => {
    const idempotencyKey = randomUUID();
    // Invalid channel triggers dispatch failure
    await outboxService.schedule(db, {
      channel: 'INVALID_CHANNEL',
      eventType: 'FAIL_EVENT',
      payload: {},
      idempotencyKey,
      maxAttempts: 3,
    });

    const result = await outboxWorker.processBatch(10);
    expect(result.failed).toBeGreaterThanOrEqual(1);

    const record = await db.outboxJob.findUnique({ where: { idempotencyKey } });
    expect(record?.status).toBe('FAILED');
    expect(record?.attemptCount).toBe(1);
    expect(record?.nextAttemptAt.getTime()).toBeGreaterThan(Date.now() + 500);
  });

  it('dead-letters a job after maxAttempts is reached', async () => {
    const idempotencyKey = randomUUID();
    await outboxService.schedule(db, {
      channel: 'INVALID_CHANNEL',
      eventType: 'FAIL_EVENT',
      payload: {},
      idempotencyKey,
      maxAttempts: 1, // Only 1 attempt allowed
    });

    await outboxWorker.processBatch(10);

    const record = await db.outboxJob.findUnique({ where: { idempotencyKey } });
    expect(record?.status).toBe('DEAD_LETTER');
    expect(record?.attemptCount).toBe(1);
  });
});
