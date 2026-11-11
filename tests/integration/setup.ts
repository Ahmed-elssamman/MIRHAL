import 'reflect-metadata';
import { config } from 'dotenv';
config({ quiet: true });
const testUrl = process.env['TEST_DATABASE_URL'];
if (!testUrl) throw new Error('TEST_DATABASE_URL is required for isolated integration tests.');
const parsed = new URL(testUrl);
if (!parsed.pathname.endsWith('_test') || !['localhost', '127.0.0.1'].includes(parsed.hostname))
  throw new Error('Integration tests require a dedicated local database ending in _test.');
process.env['DATABASE_URL'] = testUrl;
process.env['DIRECT_URL'] = testUrl;
process.env['NODE_ENV'] = 'test';
process.env['VITEST'] = 'true';

process.env['UPLOAD_DIR'] = '.local/integration-uploads';

// A developer's deployment credentials must never change test storage or send mail.
for (const key of [
  'VERCEL',
  'BLOB_READ_WRITE_TOKEN',
  'SMTP_HOST',
  'SMTP_USER',
  'SMTP_PASSWORD',
  'RESEND_API_KEY',
  'DEMO_EMAIL',
  'DEMO_PASSWORD',
  'DEMO_ADMIN_EMAIL',
  'DEMO_ADMIN_PASSWORD',
])
  delete process.env[key];
process.env['MAIL_MODE'] = 'development';
process.env['EMAIL_PROVIDER'] = 'file';
process.env['WEB_ORIGIN'] = 'http://localhost:4200';
process.env['ADMIN_ORIGIN'] = 'http://localhost:4201';
process.env['APP_URL'] = 'http://localhost:4200';
