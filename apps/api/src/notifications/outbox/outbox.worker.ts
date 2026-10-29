import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { Database } from '../../common/database';
import { MailAdapter } from '../../auth/mail.adapter';
import { notify } from '../../common/notifications';
import { TokenPurpose } from '@prisma/client';
import { EmailLanguage } from '../../auth/mail.templates';

export interface BatchProcessingResult {
  processed: number;
  succeeded: number;
  failed: number;
  deadLettered: number;
}

@Injectable()
export class OutboxWorker {
  private readonly logger = new Logger(OutboxWorker.name);

  constructor(
    @Inject(Database) private readonly db: Database,
    @Optional() @Inject(MailAdapter) private readonly mailAdapter?: MailAdapter,
  ) {}

  /**
   * Drains a batch of pending or due retryable outbox jobs.
   */
  async processBatch(batchSize = 25): Promise<BatchProcessingResult> {
    const now = new Date();
    const result: BatchProcessingResult = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      deadLettered: 0,
    };

    // Find pending jobs whose nextAttemptAt is due
    const jobs = await this.db.outboxJob.findMany({
      where: {
        status: { in: ['PENDING', 'FAILED'] },
        nextAttemptAt: { lte: now },
      },
      take: batchSize,
      orderBy: { nextAttemptAt: 'asc' },
    });

    if (jobs.length === 0) return result;

    for (const job of jobs) {
      result.processed++;
      const start = performance.now();

      // Claim job
      await this.db.outboxJob.update({
        where: { id: job.id },
        data: { status: 'PROCESSING' },
      });

      try {
        const payload = JSON.parse(job.payload);
        await this.dispatch(job.channel, job.eventType, payload);

        // Mark COMPLETED
        await this.db.outboxJob.update({
          where: { id: job.id },
          data: {
            status: 'COMPLETED',
            processedAt: new Date(),
          },
        });
        result.succeeded++;

        this.logger.log(
          JSON.stringify({
            level: 'info',
            event: 'outbox_job_succeeded',
            jobId: job.id,
            channel: job.channel,
            eventType: job.eventType,
            durationMs: Math.round(performance.now() - start),
          }),
        );
      } catch (error) {
        const attemptCount = job.attemptCount + 1;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorCode =
          typeof error === 'object' && error !== null && 'code' in error
            ? String((error as Record<string, unknown>)['code'])
            : 'JOB_EXECUTION_FAILED';

        if (attemptCount >= job.maxAttempts) {
          // Dead letter
          await this.db.outboxJob.update({
            where: { id: job.id },
            data: {
              status: 'DEAD_LETTER',
              attemptCount,
              lastErrorCode: errorCode,
              lastError: errorMessage,
              processedAt: new Date(),
            },
          });
          result.deadLettered++;

          this.logger.error(
            JSON.stringify({
              level: 'error',
              event: 'outbox_job_dead_letter',
              jobId: job.id,
              channel: job.channel,
              eventType: job.eventType,
              attempts: attemptCount,
              error: errorMessage,
            }),
          );
        } else {
          // Exponential backoff: min(5 min, 1000ms * 2^attempt)
          const backoffMs = Math.min(300000, 1000 * Math.pow(2, attemptCount));
          const nextAttemptAt = new Date(Date.now() + backoffMs);

          await this.db.outboxJob.update({
            where: { id: job.id },
            data: {
              status: 'FAILED',
              attemptCount,
              nextAttemptAt,
              lastErrorCode: errorCode,
              lastError: errorMessage,
            },
          });
          result.failed++;

          this.logger.warn(
            JSON.stringify({
              level: 'warn',
              event: 'outbox_job_retry_scheduled',
              jobId: job.id,
              attempt: attemptCount,
              nextAttemptAt: nextAttemptAt.toISOString(),
              error: errorMessage,
            }),
          );
        }
      }
    }

    return result;
  }

  private async dispatch(channel: string, _eventType: string, payload: unknown) {
    if (channel === 'EMAIL') {
      if (!this.mailAdapter) throw new Error('MailAdapter is not available');
      const { to, purpose, token, language } = payload as {
        to: string;
        purpose: TokenPurpose;
        token: string;
        language?: EmailLanguage;
      };
      await this.mailAdapter.send(to, purpose, token, language);
      return;
    }

    if (channel === 'IN_APP') {
      await notify(this.db, { data: payload as Parameters<typeof notify>[1]['data'] });
      return;
    }

    throw new Error(`Unsupported outbox channel: ${channel}`);
  }
}
