import { Injectable, Logger } from '@nestjs/common';
import { MailProvider, MailMessage, MailResult } from './mail.types';
import { SmtpProvider } from './providers/smtp.provider';
import { ResendProvider } from './providers/resend.provider';
import { FileProvider } from './providers/file.provider';
import { MemoryMailProvider } from './providers/memory.provider';
import { CircuitBreaker } from './circuit-breaker/circuit-breaker';

export class CircuitBreakerMailProviderWrapper implements MailProvider {
  constructor(
    private readonly provider: MailProvider,
    readonly circuitBreaker: CircuitBreaker,
  ) {}

  get name() {
    return this.provider.name;
  }

  async send(message: MailMessage): Promise<MailResult> {
    return this.circuitBreaker.execute(() => this.provider.send(message));
  }
}

@Injectable()
export class MailFactory {
  private readonly logger = new Logger(MailFactory.name);

  createProvider(providerName: string, apiKey?: string): MailProvider {
    let baseProvider: MailProvider;

    switch (providerName) {
      case 'smtp':
        baseProvider = new SmtpProvider();
        break;
      case 'resend':
        baseProvider = new ResendProvider(apiKey);
        break;
      case 'memory':
        baseProvider = new MemoryMailProvider();
        break;
      case 'file':
      default:
        baseProvider = new FileProvider();
        break;
    }

    const circuitBreaker = new CircuitBreaker(baseProvider.name, {
      failureThreshold: 5,
      rollingWindowMs: 60000,
      cooldownMs: 30000,
      requestTimeoutMs: 10000,
      maxTransientRetries: 0,
      retryBackoffMs: 250,
    });

    return new CircuitBreakerMailProviderWrapper(baseProvider, circuitBreaker);
  }
}
