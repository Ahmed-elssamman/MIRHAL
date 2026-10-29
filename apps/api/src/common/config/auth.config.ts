import { registerAs } from '@nestjs/config';

export interface AuthConfig {
  cookieName: string;
  sessionDurationMs: number;
  maxSessionRenewWindowMs: number;
  maxTokenBudgetPerHour: number;
  argon2: {
    memoryCost: number;
    timeCost: number;
    parallelism: number;
  };
}

export const authConfig = registerAs('auth', (): AuthConfig => ({
  cookieName: 'lq_session',
  sessionDurationMs: 60 * 60 * 1000, // 1 hour
  maxSessionRenewWindowMs: 7 * 24 * 60 * 60 * 1000, // 7 days
  maxTokenBudgetPerHour: 5,
  argon2: {
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  },
}));
