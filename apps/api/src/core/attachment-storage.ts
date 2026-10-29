import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { Database } from '../common/database';

// Bound total attachment bytes independently of the number of feedback threads.
const STORAGE_LIMIT = 100 * 1024 * 1024;
const FILE_LIMIT = 2 * 1024 * 1024;

@Injectable()
export class AttachmentStorage {
  constructor(@Inject(Database) private readonly db: Database) {}

  async put(data: Buffer, tx?: Prisma.TransactionClient): Promise<string> {
    if (!data.length || data.length > FILE_LIMIT) throw new Error('Invalid attachment size');
    if (!tx) return this.db.$transaction((client) => this.put(data, client));
    // Serialize quota checks across API instances until the enclosing transaction commits.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(726381947)`;
    const usage = await tx.attachmentContent.aggregate({ _sum: { size: true } });
    if ((usage._sum.size ?? 0) + data.length > STORAGE_LIMIT)
      throw new ServiceUnavailableException('Attachment storage is full.');
    const key = randomUUID();
    await tx.attachmentContent.create({
      data: { storageKey: key, data: Uint8Array.from(data), size: data.length },
    });
    return key;
  }

  async read(key: string): Promise<Buffer> {
    const item = await this.db.attachmentContent.findUnique({ where: { storageKey: key } });
    if (!item) throw new Error('Attachment not found');
    return Buffer.from(item.data);
  }

  async remove(key: string) {
    await this.db.attachmentContent.deleteMany({ where: { storageKey: key } });
  }
}

export const attachmentSelect = { id: true, name: true, size: true, mimeType: true } as const;
