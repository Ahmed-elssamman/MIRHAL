import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { execFileSync } from 'node:child_process';
config({ quiet: true });
const value = process.env.TEST_DATABASE_URL;
if (!value) throw new Error('TEST_DATABASE_URL is required.');
const url = new URL(value);
if (!['localhost', '127.0.0.1'].includes(url.hostname) || !url.pathname.endsWith('_test'))
  throw new Error('Migration validation requires isolated local PostgreSQL.');
const db = new PrismaClient({ datasources: { db: { url: value } } });
const name = 'lifequest_migration_shadow_test';
if (!(await db.$queryRaw`SELECT 1 FROM pg_database WHERE datname=${name}`).length)
  await db.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
await db.$disconnect();
url.pathname = '/' + name;
try {
  execFileSync(
    process.execPath,
    [
      'node_modules/prisma/build/index.js',
      'migrate',
      'diff',
      '--from-migrations',
      'prisma/migrations',
      '--to-schema-datamodel',
      'prisma/schema.prisma',
      '--shadow-database-url',
      url.href,
      '--exit-code',
    ],
    { env: { ...process.env, DATABASE_URL: value, DIRECT_URL: value }, stdio: 'pipe' },
  );
  console.log('Prisma schema matches the complete migration history.');
} catch {
  console.error('Migration/schema validation failed. Connection details suppressed.');
  process.exitCode = 1;
}
