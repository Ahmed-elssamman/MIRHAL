# Local development

## Prerequisites

- Node.js 24.21.0 and npm.
- PostgreSQL command line tools (`initdb`, `pg_ctl`, `psql`, and `createdb`) on `PATH`.
- Dependencies installed with `npm ci`.

## Local API and database

Create the ignored local configuration once; `-n` leaves an existing file intact:

```bash
cp -n .env.local.example .env.local
npm run db:local
npm run db:deploy:local
npm run db:seed:local
npm run dev
```

`db:local` provisions `lifequest` and `lifequest_test` on `127.0.0.1:55432`. The local launcher reads `.env.local`, validates every database URL points to localhost on that port, and then starts Web (4200), Admin (4201), and API (3333). It does not load or fall back to `.env`, which may contain a different database target.

The launcher variants use the same local guard:

```bash
npm run dev:web
npm run dev:admin
npm run dev:api
```

After changing the Prisma schema, regenerate the client and apply migrations to the local database:

```bash
npm run db:generate
npm run db:deploy:local
```

Reference catalog data can be refreshed with `npm run db:seed:local`. Optional `DEMO_EMAIL`/`DEMO_PASSWORD` and `DEMO_ADMIN_EMAIL`/`DEMO_ADMIN_PASSWORD` values belong only in `.env.local` when you need seed accounts.

## Integration and performance tests

The test database must be isolated and named `lifequest_test` on localhost. Prepare it with:

```bash
npm run db:deploy:test:local
npm run db:seed:test:local
npm run test:integration
npm run test:performance
```

The integration test setup independently rejects remote database URLs. The performance command writes local evidence under ignored `.local/audit/` and removes its disposable user, habits, and logs when it finishes.

## Local Web with the production API

Edit only `API_ORIGIN` in `.env.local` to `https://mirhal.onrender.com`, then run:

```bash
npm run dev:hybrid
```

Hybrid mode starts Web and Admin without the local API/database and requires an HTTPS origin. Browser requests still use `/api` on the local dev server and are proxied to `API_ORIGIN`. Requests that write data will affect the selected production account.

To return to the local stack, set `API_ORIGIN=http://localhost:3333` and run `npm run dev` again. Local frontend code uses relative `/api` paths; production API routing is configured by the Vercel packaging workflow, not by changing Angular browser environment files.

## Email and builds

Local email uses the file adapter (`EMAIL_PROVIDER=file`, `MAIL_MODE=development`); inspect generated messages under `.local/mail/`. Production provider credentials are never needed for local startup or tests.

`npm run build` now runs Prisma client generation before the Nx production build, which is required because hosted npm installs may suppress package lifecycle scripts. Run `npm run typecheck`, `npm test`, and `npm run lint` for code checks.
