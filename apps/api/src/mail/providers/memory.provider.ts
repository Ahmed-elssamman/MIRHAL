import { Injectable } from '@nestjs/common';
import { MailMessage, MailProvider, MailResult } from '../mail.types';

@Injectable()
export class MemoryMailProvider implements MailProvider {
  readonly name = 'memory';
  readonly outbox: MailMessage[] = [];

  async send(message: MailMessage): Promise<MailResult> {
    this.outbox.push(message);
    return { success: true, provider: this.name, messageId: message.key };
  }

  clear() {
    this.outbox.length = 0;
  }
}
