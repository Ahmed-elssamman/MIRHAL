import { ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerLimitDetail } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { ApiRequest } from '../../common/http';
import { clientTracker } from '../client-tracker';

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(req: Record<string, unknown>): Promise<string> {
    return clientTracker(req as unknown as Request);
  }

  protected override async throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail: ThrottlerLimitDetail,
  ): Promise<void> {
    const httpContext = context.switchToHttp();
    const response = httpContext.getResponse<Response>();
    const request = httpContext.getRequest<ApiRequest>();

    const retryAfter = Math.max(
      1,
      throttlerLimitDetail.timeToBlockExpire || throttlerLimitDetail.timeToExpire || 60,
    );

    if (response && typeof response.setHeader === 'function') {
      response.setHeader('Retry-After', String(retryAfter));
    }

    throw new HttpException(
      {
        code: 'TOO_MANY_REQUESTS',
        message: 'Too many requests. Please try again shortly.',
        retryAfter,
        requestId: request?.requestId,
        timestamp: new Date().toISOString(),
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
