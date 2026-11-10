import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { configureApp } from './bootstrap';
import { ChallengesService } from './social/challenges.service';
import { AttachmentCleanup } from './core/attachment-cleanup';
import { Database } from './common/database';
import { cleanupExpiredRecords } from './common/maintenance.controller';
import { StartupConfigurationError, validateStartupEnvironment } from './common/startup';
async function main() {
  validateStartupEnvironment();
  const { AppModule } = await import('./app.module');
  const app = configureApp(
    await NestFactory.create(AppModule, { logger: ['warn', 'error'], bodyParser: false }),
  );
  app.enableShutdownHooks();
  await app.listen(Number(process.env['PORT'] ?? 3333), '0.0.0.0');
  const challenges = app.get(ChallengesService);
  const cleanup = app.get(AttachmentCleanup);
  const db = app.get(Database);
  let running = false;
  let lastDatabaseCleanup = 0;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      const actions = [
        { name: 'challenges', run: () => challenges.tick() },
        { name: 'attachments', run: () => cleanup.drain() },
        ...(Date.now() - lastDatabaseCleanup >= 60 * 60 * 1000
          ? [
              {
                name: 'database',
                run: async () => {
                  await cleanupExpiredRecords(db);
                  lastDatabaseCleanup = Date.now();
                },
              },
            ]
          : []),
      ];
      for (const action of actions) {
        try {
          await action.run();
        } catch {
          console.error(
            JSON.stringify({
              level: 'error',
              code: 'MAINTENANCE_TICK_FAILED',
              task: action.name,
            }),
          );
        }
      }
    } finally {
      running = false;
    }
  }, 60000);
  timer.unref();
  console.log(
    JSON.stringify({
      level: 'info',
      event: 'application_ready',
      port: Number(process.env['PORT'] ?? 3333),
      version: '0.1.0',
    }),
  );
}
main().catch((error: unknown) => {
  console.error(
    JSON.stringify({
      level: 'error',
      code: 'STARTUP_FAILED',
      message:
        error instanceof StartupConfigurationError
          ? error.message
          : 'Check environment configuration and database availability.',
    }),
  );
  process.exitCode = 1;
});
