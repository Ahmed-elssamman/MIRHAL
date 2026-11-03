import { parse } from 'dotenv';
import { spawnSync } from 'node:child_process';
import { mkdirSync, existsSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
const root = resolve('.local');
mkdirSync(root, { recursive: true, mode: 0o700 });
const pgdata = resolve(root, 'postgres');
const envFile = resolve('.env');
if (!existsSync(envFile)) {
  const password = randomBytes(24).toString('hex');
  const url = `postgresql://lifequest:${password}@127.0.0.1:55432/lifequest`;
  writeFileSync(
    envFile,
    `DATABASE_URL=${url}\nDIRECT_URL=${url}\nTEST_DATABASE_URL=${url}_test\nNODE_ENV=development\nPORT=3333\nWEB_ORIGIN=http://localhost:4200\nADMIN_ORIGIN=http://localhost:4201\nAPP_URL=http://localhost:4200\nDEMO_EMAIL=demo@lifequest.local\nDEMO_PASSWORD=${randomBytes(12).toString('base64url')}\nDEMO_ADMIN_EMAIL=admin@lifequest.local\nDEMO_ADMIN_PASSWORD=${randomBytes(18).toString('base64url')}\nMAIL_MODE=development\n`,
    { mode: 0o600 },
  );
}
chmodSync(envFile, 0o600);
const env = parse(readFileSync(envFile));
const url = new URL(env.TEST_DATABASE_URL || env.DATABASE_URL);
if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.port !== '55432') {
  console.log('Existing database configuration preserved. Local provisioning skipped.');
  process.exit(0);
}
function run(command, args, input) {
  const result = spawnSync(command, args, {
    input,
    encoding: 'utf8',
    env: { ...process.env, PGPASSWORD: decodeURIComponent(url.password) },
  });
  if (result.status !== 0) {
    console.error(
      `${command} failed: ${result.stderr.replaceAll(decodeURIComponent(url.password), '[redacted]')}`,
    );
    process.exit(1);
  }
  return result.stdout;
}
if (!existsSync(pgdata))
  run('initdb', [
    '-D',
    pgdata,
    '-U',
    'lifequest',
    '--auth-local=trust',
    '--auth-host=scram-sha-256',
  ]);
const status = spawnSync('pg_ctl', ['-D', pgdata, 'status'], { stdio: 'ignore' });
if (status.status !== 0)
  run('pg_ctl', [
    '-D',
    pgdata,
    '-l',
    resolve(root, 'postgres.log'),
    '-o',
    `-p 55432 -h 127.0.0.1 -k "${root}"`,
    'start',
  ]);
run(
  'psql',
  ['-h', root, '-p', '55432', '-U', 'lifequest', '-d', 'postgres'],
  `ALTER USER lifequest PASSWORD '${decodeURIComponent(url.password).replaceAll("'", "''")}';`,
);
for (const database of ['lifequest', 'lifequest_test']) {
  const found = run('psql', [
    '-h',
    '127.0.0.1',
    '-p',
    '55432',
    '-U',
    'lifequest',
    '-d',
    'postgres',
    '-tAc',
    `SELECT 1 FROM pg_database WHERE datname='${database}'`,
  ]);
  if (!found.trim())
    run('createdb', ['-h', '127.0.0.1', '-p', '55432', '-U', 'lifequest', database]);
}
console.log(
  'Local development and isolated test databases are ready. Credentials are stored only in .env.',
);
