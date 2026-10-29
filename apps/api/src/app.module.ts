import { Controller, Get, Inject, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Database, DatabaseModule } from './common/database';
import { Public } from './common/http';
import { AppConfigModule } from './common/config/config.module';
import { RateLimitModule } from './rate-limit/rate-limit.module';
import { MailModule } from './mail/mail.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AuthModule } from './auth/auth.module';
import { CoreModule } from './core/core.module';
import { GamificationModule } from './gamification/gamification.module';
import { SocialModule } from './social/social.module';
import { AdminModule } from './admin/admin.module';
import { MaintenanceController } from './common/maintenance.controller';
import { SessionAuthGuard } from './auth/guards/session-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';

@Controller('health')
class HealthController {
  constructor(@Inject(Database) private readonly db: Database) {}

  @Public()
  @Get()
  async health() {
    await this.db.$queryRaw`SELECT 1`;
    return { status: 'ok', version: '0.1.0' };
  }
}

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    RateLimitModule,
    MailModule,
    NotificationsModule,
    AuthModule,
    CoreModule,
    GamificationModule,
    SocialModule,
    AdminModule,
  ],
  controllers: [HealthController, MaintenanceController],
  providers: [
    // Separation of concerns: SessionAuthGuard (AuthN) followed by RolesGuard (AuthZ)
    { provide: APP_GUARD, useClass: SessionAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
