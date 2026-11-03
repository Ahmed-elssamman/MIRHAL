import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerStorage } from '@nestjs/throttler';
import { RATE_LIMIT_STORAGE } from './rate-limit.types';
import { RedisRateLimitStorage } from './adapters/redis-rate-limit.storage';
import { InMemoryRateLimitStorage } from './adapters/in-memory-rate-limit.storage';
import { AppThrottlerGuard } from './guards/app-throttler.guard';
import { clientTracker } from './client-tracker';
import { Request } from 'express';

@Global()
@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      inject: [RATE_LIMIT_STORAGE],
      useFactory: (storage: ThrottlerStorage) => ({
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
      useFactory: (config: ConfigService) => {
        const isProd = config.get<string>('NODE_ENV') === 'production';
        const redisUrl = config.get<string>('REDIS_URL');
        const mode = config.get<string>('RATE_LIMIT_MODE');

        if (redisUrl && (mode === 'redis' || mode === 'auto' || isProd)) {
          return new RedisRateLimitStorage(redisUrl);
        }

        if (isProd && mode === 'redis') {
          throw new Error(
            'Production rate limiting with RATE_LIMIT_MODE=redis requires REDIS_URL to be configured.',
          );
        }

        // Local development, memory mode, or production fallback when REDIS_URL is omitted
        return new InMemoryRateLimitStorage();
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
