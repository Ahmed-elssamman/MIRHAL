import { Injectable, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { TokenPurpose } from '@prisma/client';
import { EmailLanguage, EmailPurpose, renderAuthEmail } from './mail.templates';
import { MailMessage, classifyDeliveryError } from '../mail/mail.types';
import { MailFactory } from '../mail/mail.factory';

type Message = { to: string; purpose: EmailPurpose; url: string; language: EmailLanguage };

@Injectable()
export class MailAdapter implements OnModuleInit {
  readonly outbox: Message[] = [];
  private readonly factory: MailFactory;

  constructor(factory?: MailFactory) {
    this.factory = factory ?? new MailFactory();
  }

  onModuleInit() {
    if (process.env['NODE_ENV'] === 'production' && this.enabled) this.assertConfigured();
  }

  get enabled() {
    return process.env['MAIL_MODE'] !== 'disabled';
  }

  private get providerName() {
    return (
      process.env['EMAIL_PROVIDER'] ?? (process.env['NODE_ENV'] === 'production' ? '' : 'file')
    );
  }

  configurationHealth() {
    const provider = this.providerName;
    if (!this.enabled) return { provider, status: 'disabled' as const };
    try {
      this.assertConfigured();
      return { provider, status: 'configured' as const };
    } catch {
      return { provider, status: 'incomplete' as const };
    }
  }

  assertConfigured() {
    if (!this.enabled)
      throw new ServiceUnavailableException(
        'Email verification and password recovery are currently unavailable.',
      );
    const provider = this.providerName;
    const required = ['APP_URL', 'SMTP_FROM'];
    if (provider === 'smtp') required.push('SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD');
    else if (provider === 'resend') required.push('RESEND_API_KEY');
    else if (provider !== 'file' || process.env['NODE_ENV'] === 'production')
      throw new ServiceUnavailableException('Email provider is not configured.');
    if (provider !== 'file' && required.some((name) => !process.env[name]))
      throw new ServiceUnavailableException('Email delivery is not configured.');
    if (
      provider === 'smtp' &&
      (!Number.isInteger(Number(process.env['SMTP_PORT'] ?? 465)) ||
        Number(process.env['SMTP_PORT'] ?? 465) < 1 ||
        Number(process.env['SMTP_PORT'] ?? 465) > 65535 ||
        !['true', 'false'].includes(process.env['SMTP_SECURE'] ?? 'true'))
    )
      throw new ServiceUnavailableException('SMTP port is invalid.');
    if (provider !== 'file') {
      try {
        const url = new URL(process.env['APP_URL']!);
        if (
          url.protocol !== 'https:' &&
          (process.env['NODE_ENV'] === 'production' || url.protocol !== 'http:')
        )
          throw new Error('Invalid protocol');
      } catch {
        throw new ServiceUnavailableException('APP_URL is invalid.');
      }
    }
  }

  async send(to: string, purpose: TokenPurpose, token: string, language: EmailLanguage = 'ar') {
    this.assertConfigured();
    const path = purpose === 'VERIFY_EMAIL' ? 'verify-email' : 'reset-password';
    const origin = new URL(process.env['APP_URL'] ?? 'http://localhost:4200').origin;
    const url = `${origin}/auth/${path}?token=${encodeURIComponent(token)}`;
    const mail: Message = { to, purpose, url, language };

    if (process.env['NODE_ENV'] === 'test') {
      this.outbox.push(mail);
      return;
    }

    const { html, text, subject } = renderAuthEmail(purpose, language, url, {
      appUrl: origin,
      logoUrl: new URL('/mirhal-email-logo.png', origin).href,
      supportEmail: process.env['SUPPORT_EMAIL'] || undefined,
    });
    const delivery: MailMessage = {
      ...mail,
      from: process.env['SMTP_FROM']!,
      subject,
      html,
      text,
      key: createHash('sha256').update(`${purpose}:${token}`).digest('hex'),
      purpose,
      language,
    };

    await this.deliver(delivery, purpose);
  }

  async sendPasswordChanged(to: string, eventId: string, language: EmailLanguage = 'ar') {
    if (!this.enabled) return;
    this.assertConfigured();
    const origin = new URL(process.env['APP_URL'] ?? 'http://localhost:4200').origin;
    const url = new URL('/auth/login', origin).href;
    const purpose: EmailPurpose = 'PASSWORD_CHANGED';
    const mail: Message = { to, purpose, url, language };
    if (process.env['NODE_ENV'] === 'test') {
      this.outbox.push(mail);
      return;
    }
    const { html, text, subject } = renderAuthEmail(purpose, language, url, {
      appUrl: origin,
      logoUrl: new URL('/mirhal-email-logo.png', origin).href,
      supportEmail: process.env['SUPPORT_EMAIL'] || undefined,
    });
    const delivery: MailMessage = {
      ...mail,
      from: process.env['SMTP_FROM']!,
      subject,
      html,
      text,
      key: createHash('sha256').update(`${purpose}:${eventId}`).digest('hex'),
      purpose,
      language,
    };
    await this.deliver(delivery, purpose);
  }

  async sendFriendInvite(
    to: string,
    inviterName: string,
    eventId: string,
    language: EmailLanguage = 'ar',
    inviteToken?: string,
  ) {
    this.assertConfigured();
    const origin = new URL(process.env['APP_URL'] ?? 'http://localhost:4200').origin;
    const url = inviteToken
      ? new URL(`/auth/register?inviteToken=${encodeURIComponent(inviteToken)}`, origin).href
      : new URL('/auth/register', origin).href;
    const purpose: EmailPurpose = 'FRIEND_INVITE';
    const mail: Message = { to, purpose, url, language };
    if (process.env['NODE_ENV'] === 'test') {
      this.outbox.push(mail);
      return;
    }
    const { html, text, subject } = renderAuthEmail(purpose, language, url, {
      appUrl: origin,
      logoUrl: new URL('/mirhal-email-logo.png', origin).href,
      supportEmail: process.env['SUPPORT_EMAIL'] || undefined,
      inviterName,
    });
    const delivery: MailMessage = {
      ...mail,
      from: process.env['SMTP_FROM']!,
      subject,
      html,
      text,
      key: createHash('sha256').update(`${purpose}:${eventId}`).digest('hex'),
      purpose,
      language,
    };
    await this.deliver(delivery, purpose);
  }

  private async deliver(delivery: MailMessage, purpose: EmailPurpose) {
    const provider = this.factory.createProvider(this.providerName, process.env['RESEND_API_KEY']);
    try {
      const result = await provider.send(delivery);
      console.log(
        JSON.stringify({
          level: 'info',
          event: 'email_delivery',
          provider: this.providerName,
          purpose,
          status: 'accepted',
          ...(result.messageId ? { providerMessageId: result.messageId } : {}),
        }),
      );
    } catch (error) {
      const classification = classifyDeliveryError(error);
      console.error(
        JSON.stringify({
          level: 'error',
          event: 'email_delivery',
          provider: this.providerName,
          purpose,
          status: 'failed',
          classification,
        }),
      );
      throw new ServiceUnavailableException(
        'Email could not be delivered. Please try again later.',
      );
    }
  }
}
