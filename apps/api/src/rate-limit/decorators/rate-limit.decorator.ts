import { Throttle } from '@nestjs/throttler';
import { RATE_LIMIT_TIERS } from '../rate-limit.types';

export const RateLimitLogin = () =>
  Throttle({
    default: { limit: RATE_LIMIT_TIERS['login']!.limit, ttl: RATE_LIMIT_TIERS['login']!.ttl },
  });

export const RateLimitRegister = () =>
  Throttle({
    default: { limit: RATE_LIMIT_TIERS['register']!.limit, ttl: RATE_LIMIT_TIERS['register']!.ttl },
  });

export const RateLimitForgotPassword = () =>
  Throttle({
    default: {
      limit: RATE_LIMIT_TIERS['forgotPassword']!.limit,
      ttl: RATE_LIMIT_TIERS['forgotPassword']!.ttl,
    },
  });

export const RateLimitResetPassword = () =>
  Throttle({
    default: {
      limit: RATE_LIMIT_TIERS['resetPassword']!.limit,
      ttl: RATE_LIMIT_TIERS['resetPassword']!.ttl,
    },
  });

export const RateLimitVerifyEmail = () =>
  Throttle({
    default: {
      limit: RATE_LIMIT_TIERS['verifyEmail']!.limit,
      ttl: RATE_LIMIT_TIERS['verifyEmail']!.ttl,
    },
  });

export const RateLimitUpload = () =>
  Throttle({
    default: { limit: RATE_LIMIT_TIERS['uploads']!.limit, ttl: RATE_LIMIT_TIERS['uploads']!.ttl },
  });

export const RateLimitAdmin = () =>
  Throttle({
    default: {
      limit: RATE_LIMIT_TIERS['adminMutations']!.limit,
      ttl: RATE_LIMIT_TIERS['adminMutations']!.ttl,
    },
  });

export const RateLimitPublic = () =>
  Throttle({
    default: {
      limit: RATE_LIMIT_TIERS['publicEndpoints']!.limit,
      ttl: RATE_LIMIT_TIERS['publicEndpoints']!.ttl,
    },
  });

export const RateLimitAuthenticated = () =>
  Throttle({
    default: {
      limit: RATE_LIMIT_TIERS['authenticatedReads']!.limit,
      ttl: RATE_LIMIT_TIERS['authenticatedReads']!.ttl,
    },
  });
