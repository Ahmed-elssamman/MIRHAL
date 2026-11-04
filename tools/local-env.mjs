import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const envPath = resolve('.env.local');
if (!existsSync(envPath)) {
  console.error('Create .env.local from .env.local.example before using local commands.');
  process.exit(1);
}

config({ path: envPath, quiet: true });
const action = process.argv[2] ?? 'dev';
if (action === 'hybrid') {
  try {
    const api = new URL(process.env['API_ORIGIN'] ?? '');
    if (api.protocol !== 'https:' || api.origin !== process.env['API_ORIGIN']) throw new Error();
  } catch {
    console.error('Hybrid development requires API_ORIGIN to be an HTTPS origin.');
    process.exit(1);
  }
} else {
  for (const name of ['DATABASE_URL', 'DIRECT_URL', 'TEST_DATABASE_URL']) {
    let databaseUrl;
    try {
      databaseUrl = new URL(process.env[name] ?? '');
    } catch {
      console.error(`${name} must point to the local PostgreSQL instance.`);
      process.exit(1);
    }
    if (
      !['127.0.0.1', 'localhost'].includes(databaseUrl.hostname) ||
      databaseUrl.port !== '55432'
    ) {
      console.error(`${name} must point to the local PostgreSQL instance on port 55432.`);
      process.exit(1);
    }
  }
}

const nx = resolve('node_modules/nx/dist/bin/nx.js');
const prisma = resolve('node_modules/prisma/build/index.js');
const tsx = resolve('node_modules/tsx/dist/cli.mjs');
const commands = {
  dev: [
    process.execPath,
    [nx, 'run-many', '-t', 'serve', '-p', 'web', 'admin', 'api', '--parallel=3'],
  ],
  web: [process.execPath, [nx, 'serve', 'web']],
  admin: [process.execPath, [nx, 'serve', 'admin']],
  api: [process.execPath, [nx, 'serve', 'api']],
  hybrid: [process.execPath, [nx, 'run-many', '-t', 'serve', '-p', 'web', 'admin', '--parallel=2']],
  migrate: [process.execPath, [prisma, 'migrate', 'deploy']],
  'migrate-test': [process.execPath, [prisma, 'migrate', 'deploy']],
  seed: [process.execPath, [tsx, 'prisma/seed.ts']],
  'seed-test': [process.execPath, [tsx, 'prisma/seed.ts']],
};
const command = commands[action];
if (!command) {
  console.error(
    'Supported local actions: dev, web, admin, api, hybrid, migrate, migrate-test, seed, seed-test.',
  );
  process.exit(2);
}

if (action === 'migrate-test' || action === 'seed-test') {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.DIRECT_URL = process.env.TEST_DATABASE_URL;
}
const result = spawnSync(command[0], command[1], {
  env: process.env,
  stdio: 'inherit',
});
if (result.error) {
  console.error(`Could not start the local ${action} command.`);
  process.exit(1);
}
process.exit(result.status ?? 1);
