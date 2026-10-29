import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { OutboxWorker } from './notifications/outbox/outbox.worker';
import { ChallengesService } from './social/challenges.service';
import { AttachmentCleanup } from './core/attachment-cleanup';
import { Database } from './common/database';
import { cleanupExpiredRecords } from './common/maintenance.controller';
import { validateStartupEnvironment } from './common/startup';

async function bootstrapWorker() {
  validateStartupEnvironment();

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['warn', 'error'],
  });

  const outboxWorker = app.get(OutboxWorker);
  const challenges = app.get(ChallengesService);
  const cleanup = app.get(AttachmentCleanup);
  const db = app.get(Database);

  let isRunning = false;
  let lastDatabaseCleanup = 0;

  const tick = async () => {
    if (isRunning) return;
    isRunning = true;
    try {
      // 1. Process outbox background jobs
      await outboxWorker.processBatch(50);

      // 2. Process challenge lifecycles
      await challenges.tick();

      // 3. Clean up expired attachments
      await cleanup.drain();

      // 4. Periodic database cleanup (once per hour)
      if (Date.now() - lastDatabaseCleanup >= 60 * 60 * 1000) {
        await cleanupExpiredRecords(db);
        lastDatabaseCleanup = Date.now();
      }
    } catch (error) {
      console.error(
        JSON.stringify({
          level: 'error',
          code: 'WORKER_TICK_ERROR',
          message: error instanceof Error ? error.message : 'Unknown worker error',
        }),
      );
    } finally {
      isRunning = false;
    }
  };

  const isOneShot = process.argv.includes('--once');

  if (isOneShot) {
    console.log(JSON.stringify({ level: 'info', event: 'worker_run_once_start' }));
    await tick();
    console.log(JSON.stringify({ level: 'info', event: 'worker_run_once_complete' }));
    await app.close();
    process.exit(0);
  }

  console.log(JSON.stringify({ level: 'info', event: 'worker_daemon_started' }));

  // Run initial tick immediately
  await tick();

  // Schedule recurring tick every 10 seconds for high responsiveness
  const interval = setInterval(tick, 10000);

  const shutdown = async () => {
    clearInterval(interval);
    console.log(JSON.stringify({ level: 'info', event: 'worker_shutting_down' }));
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

bootstrapWorker().catch((err) => {
  console.error(
    JSON.stringify({
      level: 'error',
      code: 'WORKER_BOOTSTRAP_FAILED',
      message: err instanceof Error ? err.message : 'Unknown error',
    }),
  );
  process.exit(1);
});
