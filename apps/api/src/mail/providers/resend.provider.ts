import { Injectable } from '@nestjs/common';
import { setTimeout as delay } from 'node:timers/promises';
import { DeliveryError, MailMessage, MailProvider, MailResult } from '../mail.types';

@Injectable()
export class ResendProvider implements MailProvider {
  readonly name = 'resend';

  constructor(private readonly apiKey?: string) {}

  async send(message: MailMessage): Promise<MailResult> {
    const key = this.apiKey ?? process.env['RESEND_API_KEY'];
    const request = {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': message.key,
      },
      body: JSON.stringify({
        from: message.from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    };

    for (let attempt = 0; attempt < 2; attempt++) {
      let response: Response;
      try {
        response = await fetch('https://api.resend.com/emails', {
          ...request,
          signal: AbortSignal.timeout(10000),
        });
      } catch (error) {
        if (attempt === 1) throw error;
        await delay(250);
        continue;
      }

      if (response.ok) {
        let messageId: string | undefined;
        try {
          const body: unknown = await response.json();
          if (
            typeof body === 'object' &&
            body !== null &&
            'id' in body &&
            typeof body.id === 'string'
          )
            messageId = body.id;
        } catch {
          // Acceptance does not depend on an optional provider response body.
        }
        return { success: true, provider: this.name, messageId };
      }

      if (response.status >= 500 && attempt === 0) {
        await delay(250);
        continue;
      }

      throw new DeliveryError(
        response.status === 429 || response.status >= 500 ? 'temporary' : 'permanent',
      );
    }

    throw new DeliveryError('temporary', 'Max retries exhausted for Resend');
  }
}
