import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Database } from '../../common/database';

export interface ScheduleJobInput {
  channel: string;
  eventType: string;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  maxAttempts?: number;
  delayMs?: number;
}

@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);

  constructor(private readonly db: Database) {}

  /**
   * Schedules a background job atomically within the caller's Prisma transaction.
   * Ensures exactly-once enrollment and zero lost jobs during crashes.
   */
  async schedule(tx: Prisma.TransactionClient | Database, input: ScheduleJobInput) {
    const nextAttemptAt = new Date(Date.now() + (input.delayMs ?? 0));
    try {
      const job = await tx.outboxJob.upsert({
        where: { idempotencyKey: input.idempotencyKey },
        create: {
          channel: input.channel,
          eventType: input.eventType,
          payload: JSON.stringify(input.payload),
          idempotencyKey: input.idempotencyKey,
          status: 'PENDING',
          attemptCount: 0,
          maxAttempts: input.maxAttempts ?? 5,
          nextAttemptAt,
        },
        update: {}, // Idempotent: does not overwrite if already scheduled
      });

      this.logger.log(
        JSON.stringify({
          level: 'info',
          event: 'outbox_job_scheduled',
          jobId: job.id,
          channel: job.channel,
          eventType: job.eventType,
          idempotencyKey: job.idempotencyKey,
        }),
      );

      return job;
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          level: 'error',
          event: 'outbox_schedule_failed',
          channel: input.channel,
          eventType: input.eventType,
          message: error instanceof Error ? error.message : 'Unknown error',
        }),
      );
      throw error;
    }
  }
}
