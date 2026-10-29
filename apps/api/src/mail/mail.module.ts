import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MAIL_PROVIDER } from './mail.types';
import { MailFactory } from './mail.factory';
import { SmtpProvider } from './providers/smtp.provider';
import { ResendProvider } from './providers/resend.provider';
import { FileProvider } from './providers/file.provider';
import { MemoryMailProvider } from './providers/memory.provider';

@Global()
@Module({
  providers: [
    MailFactory,
    SmtpProvider,
    ResendProvider,
    FileProvider,
    MemoryMailProvider,
    {
      provide: MAIL_PROVIDER,
      inject: [ConfigService, MailFactory],
      useFactory: (config: ConfigService, factory: MailFactory) => {
        const isProd = config.get<string>('NODE_ENV') === 'production';
        const providerName = config.get<string>('EMAIL_PROVIDER') ?? (isProd ? 'resend' : 'file');
        const apiKey = config.get<string>('RESEND_API_KEY');
        return factory.createProvider(providerName, apiKey);
      },
    },
  ],
  exports: [
    MAIL_PROVIDER,
    MailFactory,
    SmtpProvider,
    ResendProvider,
    FileProvider,
    MemoryMailProvider,
  ],
})
export class MailModule {}
