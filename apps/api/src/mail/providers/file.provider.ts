import { Injectable } from '@nestjs/common';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { MailMessage, MailProvider, MailResult } from '../mail.types';

@Injectable()
export class FileProvider implements MailProvider {
  readonly name = 'file';

  async send(message: MailMessage): Promise<MailResult> {
    await mkdir('.local/mail', { recursive: true, mode: 0o700 });
    const id = randomUUID();
    await writeFile(`.local/mail/${id}.json`, JSON.stringify(message), { mode: 0o600 });
    return { success: true, provider: this.name, messageId: id };
  }
}
