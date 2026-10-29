import { registerAs } from '@nestjs/config';

export interface DatabaseConfig {
  url: string;
  directUrl?: string;
  testUrl?: string;
}

export const databaseConfig = registerAs('database', (): DatabaseConfig => ({
  url: process.env['DATABASE_URL'] ?? '',
  directUrl: process.env['DIRECT_URL'],
  testUrl: process.env['TEST_DATABASE_URL'],
}));
