import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { MailProvider, MailMessage, MailResult } from './mail.types';
import { SmtpProvider } from './providers/smtp.provider';
import { ResendProvider } from './providers/resend.provider';
import { FileProvider } from './providers/file.provider';
import { MemoryMailProvider } from './providers/memory.provider';
import { CircuitBreaker } from './circuit-breaker/circuit-breaker';

export class CircuitBreakerMailProviderWrapper implements MailProvider {
  constructor(
    readonly provider: MailProvider,
    readonly circuitBreaker: CircuitBreaker,
  ) {}

  get name() {
    return this.provider.name;
  }

  async send(message: MailMessage): Promise<MailResult> {
    return this.circuitBreaker.execute(() => this.provider.send(message));
  }

  async verify(): Promise<boolean> {
    if (
      'verify' in this.provider &&
      typeof (this.provider as { verify?: () => Promise<boolean> }).verify === 'function'
    ) {
      return (this.provider as { verify: () => Promise<boolean> }).verify();
    }
    return true;
  }
}

@Injectable()
export class MailFactory implements OnModuleDestroy {
  private readonly logger = new Logger(MailFactory.name);
  private readonly instances = new Map<string, CircuitBreakerMailProviderWrapper>();

  getProvider(providerName: string, apiKey?: string): CircuitBreakerMailProviderWrapper {
    const key = `${providerName}:${apiKey ?? ''}`;
    const existing = this.instances.get(key);
    if (existing) {
      return existing;
    }
    const created = this.createProvider(providerName, apiKey) as CircuitBreakerMailProviderWrapper;
    this.instances.set(key, created);
    return created;
  }

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

  clearCache() {
    for (const wrapper of this.instances.values()) {
      if (
        'onModuleDestroy' in wrapper.provider &&
        typeof (wrapper.provider as { onModuleDestroy?: () => void }).onModuleDestroy === 'function'
      ) {
        (wrapper.provider as { onModuleDestroy: () => void }).onModuleDestroy();
      }
    }
    this.instances.clear();
  }

  onModuleDestroy() {
    this.clearCache();
  }
}
