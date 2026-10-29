import { registerAs } from '@nestjs/config';

export interface AppConfig {
  env: 'development' | 'test' | 'production';
  port: number;
  webOrigin: string;
  adminOrigin: string;
  appUrl: string;
  isProduction: boolean;
  isTest: boolean;
  isVercel: boolean;
  cronSecret?: string;
  trustedProxies?: string;
}

export const appConfig = registerAs('app', (): AppConfig => {
  const env = (process.env['NODE_ENV'] ?? 'development') as 'development' | 'test' | 'production';
  return {
    env,
    port: Number(process.env['PORT'] ?? 3333),
    webOrigin: process.env['WEB_ORIGIN'] ?? 'http://localhost:4200',
    adminOrigin: process.env['ADMIN_ORIGIN'] ?? 'http://localhost:4201',
    appUrl: process.env['APP_URL'] ?? 'http://localhost:4200',
    isProduction: env === 'production',
    isTest: env === 'test',
    isVercel: process.env['VERCEL'] === '1',
    cronSecret: process.env['CRON_SECRET'],
    trustedProxies: process.env['TRUSTED_PROXIES'],
  };
});
