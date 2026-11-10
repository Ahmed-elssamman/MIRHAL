import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppConfig } from '../common/config/app.config';
import type { RateLimitConfig } from '../common/config/rate-limit.config';
import { RATE_LIMIT_STORAGE, RateLimiterStorage } from './rate-limit.types';
import { createRateLimitStorage } from './rate-limit.factory';
import { AppThrottlerGuard } from './guards/app-throttler.guard';
import { clientTracker } from './client-tracker';
import { Request } from 'express';

@Global()
@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      inject: [RATE_LIMIT_STORAGE],
      useFactory: (storage: RateLimiterStorage) => ({
        throttlers: [{ name: 'default', ttl: 60000, limit: 180 }],
        getTracker: (_request, context) =>
          clientTracker(context.switchToHttp().getRequest<Request>()),
        storage,
      }),
    }),
  ],
  providers: [
    {
      provide: RATE_LIMIT_STORAGE,
      inject: [ConfigService],
      useFactory: (config: ConfigService): RateLimiterStorage => {
        const appConfig = config.get<AppConfig>('app');
        const rateLimitConfig = config.get<RateLimitConfig>('rateLimit');
        if (!appConfig || !rateLimitConfig) {
          throw new Error('Rate limit configuration is unavailable.');
        }
        return createRateLimitStorage(rateLimitConfig, appConfig.isProduction);
      },
    },
    {
      provide: APP_GUARD,
      useClass: AppThrottlerGuard,
    },
  ],
  exports: [RATE_LIMIT_STORAGE, ThrottlerModule],
})
export class RateLimitModule {}
