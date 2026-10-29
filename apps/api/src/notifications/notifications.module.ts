import { Module, Global } from '@nestjs/common';
import { OutboxService } from './outbox/outbox.service';
import { OutboxWorker } from './outbox/outbox.worker';
import { DatabaseModule } from '../common/database';

@Global()
@Module({
  imports: [DatabaseModule],
  providers: [OutboxService, OutboxWorker],
  exports: [OutboxService, OutboxWorker],
})
export class NotificationsModule {}
