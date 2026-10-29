import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { MailAdapter } from './mail.adapter';
import { DatabaseModule } from '../common/database';
import { MailModule } from '../mail/mail.module';
import { SessionAuthGuard } from './guards/session-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { AuthGuard } from './auth.guard';

@Module({
  imports: [DatabaseModule, MailModule],
  controllers: [AuthController],
  providers: [AuthService, MailAdapter, SessionAuthGuard, RolesGuard, AuthGuard],
  exports: [AuthService, MailAdapter, SessionAuthGuard, RolesGuard, AuthGuard],
})
export class AuthModule {}
