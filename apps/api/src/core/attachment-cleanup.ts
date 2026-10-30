import { Inject, Injectable, Logger } from '@nestjs/common';
import { Database } from '../common/database';
import { AttachmentStorage } from './attachment-storage';

@Injectable()
export class AttachmentCleanup {
  private readonly logger = new Logger(AttachmentCleanup.name);
  constructor(
    @Inject(Database) private readonly db: Database,
    @Inject(AttachmentStorage) private readonly storage: AttachmentStorage,
  ) {}
  async drain(keys?: string[]) {
    const pending = await this.db.attachmentDeletion.findMany({
      // Explicit erasure after account deletion should run now. The scheduled
      // maintenance pass alone observes retryAt after a storage failure.
      where: keys ? { storageKey: { in: keys } } : { retryAt: { lte: new Date() } },
      orderBy: [{ retryAt: 'asc' }, { createdAt: 'asc' }],
      take: 100,
    });
    for (const item of pending) {
      try {
        await this.storage.remove(item.storageKey);
        await this.db.attachmentDeletion.deleteMany({ where: { storageKey: item.storageKey } });
      } catch {
        // Retain the opaque key across process exits; a failing item must not starve later ones.
        await this.db.attachmentDeletion.updateMany({
          where: { storageKey: item.storageKey },
          data: { retryAt: new Date(Date.now() + 60_000) },
        });
        this.logger.warn('Attachment cleanup deferred; maintenance will retry.');
      }
    }
  }
}
