import { registerAs } from '@nestjs/config';

export interface MailConfig {
  mode: 'development' | 'disabled' | 'production';
  enabled: boolean;
  provider: 'file' | 'smtp' | 'resend' | 'memory';
  from?: string;
  supportEmail?: string;
  appUrl: string;
  smtp: {
    host?: string;
    port: number;
    secure: boolean;
    user?: string;
    password?: string;
  };
  resend: {
    apiKey?: string;
  };
  circuitBreaker: {
    failureThreshold: number;
    rollingWindowMs: number;
    cooldownMs: number;
    requestTimeoutMs: number;
  };
}

export const mailConfig = registerAs('mail', (): MailConfig => {
  const mode = (process.env['MAIL_MODE'] ?? 'development') as
    'development' | 'disabled' | 'production';
  const isProd = process.env['NODE_ENV'] === 'production';
  const defaultProvider = isProd ? 'resend' : 'file';
  const provider = (process.env['EMAIL_PROVIDER'] ?? defaultProvider) as
    'file' | 'smtp' | 'resend' | 'memory';

  return {
    mode,
    enabled: mode !== 'disabled',
    provider,
    from: process.env['SMTP_FROM'],
    supportEmail: process.env['SUPPORT_EMAIL'] || undefined,
    appUrl: process.env['APP_URL'] ?? 'http://localhost:4200',
    smtp: {
      host: process.env['SMTP_HOST'],
      port: Number(process.env['SMTP_PORT'] ?? 465),
      secure: process.env['SMTP_SECURE'] !== 'false',
      user: process.env['SMTP_USER'],
      password: process.env['SMTP_PASSWORD'],
    },
    resend: {
      apiKey: process.env['RESEND_API_KEY'],
    },
    circuitBreaker: {
      failureThreshold: 5,
      rollingWindowMs: 60 * 1000,
      cooldownMs: 30 * 1000,
      requestTimeoutMs: 10 * 1000,
    },
  };
});
