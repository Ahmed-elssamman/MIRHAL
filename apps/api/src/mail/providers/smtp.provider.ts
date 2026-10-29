import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import nodemailer, { Transporter } from 'nodemailer';
import { DeliveryError, MailMessage, MailProvider, MailResult } from '../mail.types';

export interface SmtpOptions {
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  password?: string;
}

@Injectable()
export class SmtpProvider implements MailProvider, OnModuleInit, OnModuleDestroy {
  readonly name = 'smtp';
  private transporter: Transporter | null = null;

  constructor(private readonly options: SmtpOptions = {}) {}

  onModuleInit() {
    this.initTransporter();
  }

  private initTransporter() {
    if (this.transporter) return;
    const host = this.options.host ?? process.env['SMTP_HOST'];
    const port = Number(this.options.port ?? process.env['SMTP_PORT'] ?? 465);
    const secure =
      (this.options.secure ?? process.env['SMTP_SECURE']) === true ||
      process.env['SMTP_SECURE'] === 'true';
    const user = this.options.user ?? process.env['SMTP_USER'];
    const pass = this.options.password ?? process.env['SMTP_PASSWORD'];

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      requireTLS: !secure,
      auth: user ? { user, pass } : undefined,
      connectionTimeout: 10000,
      socketTimeout: 15000,
      logger: false,
      debug: false,
    });
  }

  async send(message: MailMessage): Promise<MailResult> {
    if (!this.transporter) this.initTransporter();
    try {
      const info = await this.transporter!.sendMail({
        from: message.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });
      return { success: true, provider: this.name, messageId: info.messageId };
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'EAUTH'
      ) {
        throw new DeliveryError('permanent', 'SMTP authentication failed');
      }
      throw error;
    }
  }

  onModuleDestroy() {
    if (this.transporter) {
      this.transporter.close();
      this.transporter = null;
    }
  }
}
