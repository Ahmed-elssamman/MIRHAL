import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { execFileSync, spawn } from 'node:child_process';
import { request } from 'node:http';
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import express from 'express';
config({ quiet: true });
const source = process.env.TEST_DATABASE_URL;
if (!source) throw new Error('TEST_DATABASE_URL is required.');
const url = new URL(source);
if (!['localhost', '127.0.0.1'].includes(url.hostname) || !url.pathname.endsWith('_test') || url.searchParams.has('host') || url.searchParams.has('hostaddr'))
  throw new Error('E2E requires a dedicated local test database.');
const admin = new PrismaClient({ datasources: { db: { url: source } } });
// Every run creates a new isolated database; never truncate an existing one.
const name = `lifequest_e2e_${randomBytes(8).toString('hex')}_test`;
await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
await admin.$disconnect();
url.pathname = '/' + name;
const credentials = {
  email: 'explorer@e2e.test',
  password: randomBytes(18).toString('base64url'),
  adminEmail: 'admin@e2e.test',
  adminPassword: randomBytes(18).toString('base64url'),
};
mkdirSync('.local', { recursive: true, mode: 0o700 });
writeFileSync('.local/e2e-credentials.json', JSON.stringify(credentials), { mode: 0o600 });
const env = {
  ...process.env,
  DATABASE_URL: url.href,
  DIRECT_URL: url.href,
  NODE_ENV: 'test',
  MAIL_MODE: 'development',
  EMAIL_PROVIDER: 'file',
  UPLOAD_DIR: '.local/e2e-uploads',
  PORT: '3433',
  WEB_ORIGIN: 'http://localhost:4300',
  ADMIN_ORIGIN: 'http://localhost:4301',
  APP_URL: 'http://localhost:4300',
  DEMO_EMAIL: credentials.email,
  DEMO_PASSWORD: credentials.password,
  DEMO_ADMIN_EMAIL: credentials.adminEmail,
  DEMO_ADMIN_PASSWORD: credentials.adminPassword,
};
for (const key of [
  'VERCEL',
  'BLOB_READ_WRITE_TOKEN',
  'SMTP_HOST',
  'SMTP_USER',
  'SMTP_PASSWORD',
  'RESEND_API_KEY',
])
  delete env[key];
try {
  execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { env, stdio: 'pipe' });
} catch {
  throw new Error('Isolated E2E migrations failed.');
}
try {
  execFileSync(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'prisma/seed.ts'], { env, stdio: 'pipe' });
} catch {
  throw new Error('Isolated E2E seed failed.');
}
const seeded = new PrismaClient({ datasources: { db: { url: url.href } } });
await seeded.profile.updateMany({
  where: { user: { email: { in: [credentials.email, credentials.adminEmail] } } },
  data: { language: 'en' },
});
await seeded.$disconnect();
const api = spawn('node', ['dist/api/apps/api/src/main.js'], {
  env,
  stdio: ['ignore', 'pipe', 'pipe'],
});
api.stdout.on('data', () => {});
api.stderr.on('data', () => {});
const servers = [];
for (const [application, port] of [
  ['web', 4300],
  ['admin', 4301],
]) {
  const app = express();
  app.use('/api', (req, res) => {
    const upstream = request(
      {
        hostname: '127.0.0.1',
        port: 3433,
        method: req.method,
        path: req.originalUrl,
        headers: req.headers,
      },
      (response) => {
        res.writeHead(response.statusCode ?? 502, response.headers);
        response.pipe(res);
      },
    );
    upstream.on('error', () => res.status(502).end());
    req.pipe(upstream);
  });
  const browser = resolve('dist', application, 'browser');
  app.use(express.static(browser, { index: false }));
  app.use((_req, res) =>
    res.sendFile(resolve(browser, application === 'web' ? 'index.csr.html' : 'index.html')),
  );
  servers.push(app.listen(port, 'localhost'));
}
let ready = false;
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  api.kill('SIGTERM');
  for (const server of servers) server.close();
  setTimeout(() => process.exit(code), 500);
}
process.on('SIGTERM', () => stop());
process.on('SIGINT', () => stop());
api.on('exit', () => {
  if (!stopping) {
    console.error('The isolated test API stopped. Rebuild the API and check its configuration.');
    stop(1);
  }
});
for (let attempt = 0; attempt < 100 && !stopping; attempt++) {
  if (api.exitCode !== null) break;
  try {
    ready = (
      await fetch('http://localhost:4300/api/health', {
        signal: globalThis.AbortSignal.timeout(1000),
      })
    ).ok;
    if (ready) break;
  } catch {
    /* Allow API bootstrap to complete within the bounded startup window. */
  }
  await new Promise((resolve) => setTimeout(resolve, 100));
}
if (ready) console.log('Isolated E2E applications ready at ports 4300 and 4301.');
else {
  console.error('The isolated test API did not become healthy.');
  stop(1);
}
