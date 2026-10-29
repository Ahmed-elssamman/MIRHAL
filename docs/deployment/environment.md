# Environment variables and placement

For the confirmed production projects, follow the [operator setup runbook](operator-setup.md) for the exact Render and Resend dashboard steps.

For a fresh local setup, copy `.env.example` to an ignored local `.env`. **This workspace's existing ignored `.env` points to the confirmed production Neon database; do not replace it casually or run local reset/seed commands against it.** Use a separate local PostgreSQL database for development and `TEST_DATABASE_URL` only for disposable tests. Keep all real credentials out of Git, docs, browser assets, and logs. `DATABASE_URL`, `DIRECT_URL`, SMTP credentials, and `RESEND_API_KEY` belong only to the API process.

| Variable                                                              | Local `.env`                   | Render API                              | Vercel build shell      | Purpose                           |
| --------------------------------------------------------------------- | ------------------------------ | --------------------------------------- | ----------------------- | --------------------------------- |
| `NODE_ENV`                                                            | `development`                  | `production`                            | —                       | Secure cookies in production      |
| `PORT`                                                                | `3333`                         | Assigned by Render                      | —                       | API listen port                   |
| `DATABASE_URL`                                                        | Local PostgreSQL               | Neon pooled URL                         | —                       | Prisma runtime                    |
| `DIRECT_URL`                                                          | Local PostgreSQL               | Neon direct URL                         | —                       | Prisma migrations                 |
| `WEB_ORIGIN`                                                          | `http://localhost:4200`        | Exact HTTPS Vercel customer origin      | —                       | CORS and write Origin             |
| `ADMIN_ORIGIN`                                                        | `http://localhost:4201`        | Exact HTTPS Vercel admin origin         | —                       | CORS and write Origin             |
| `APP_URL`                                                             | `http://localhost:4200`        | Exact HTTPS Vercel customer origin      | —                       | Email links                       |
| `MAIL_MODE`                                                           | `development`                  | `enabled`                               | —                       | Existing on/off switch            |
| `EMAIL_PROVIDER`                                                      | `file` or `smtp`               | `resend`                                | —                       | Provider selection                |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD` | Gmail settings when using SMTP | —                                       | —                       | Local SMTP only                   |
| `SMTP_FROM`                                                           | Local sender                   | Verified Resend sender                  | —                       | From address                      |
| `RESEND_API_KEY`                                                      | —                              | Secret API key                          | —                       | Production HTTPS email            |
| `VERCEL_WEB_ORIGIN`                                                   | Packaging shell                | —                                       | Exact customer origin   | Existing Vercel artifact packager |
| `VERCEL_ADMIN_ORIGIN`                                                 | Packaging shell                | —                                       | Exact admin origin      | Existing deployment tooling       |
| `VERCEL_API_ORIGIN`                                                   | Packaging shell                | —                                       | Exact Render API origin | Routes customer `/api` to Render  |
| `BLOB_READ_WRITE_TOKEN`                                               | —                              | Secret for existing private Vercel Blob | —                       | Persistent feedback screenshots   |
| `UPLOAD_DIR`                                                          | Private local directory        | Alternative persistent storage path     | —                       | Feedback screenshots              |
| `REDIS_URL`                                                           | `redis://127.0.0.1:6379`       | Upstash or Redis connection URL         | —                       | Multi-instance rate limiting      |
| `RATE_LIMIT_MODE`                                                     | `memory` (dev/test only)       | `redis`                                 | —                       | Rate limiter adapter selection    |

Confirmed public values for the selected Vercel projects:

| Variable                                     | Value                                   | Placement                        |
| -------------------------------------------- | --------------------------------------- | -------------------------------- |
| `WEB_ORIGIN`, `APP_URL`, `VERCEL_WEB_ORIGIN` | `https://lifequest-web-cyan.vercel.app` | Render / trusted packaging shell |
| `ADMIN_ORIGIN`, `VERCEL_ADMIN_ORIGIN`        | `https://lifequest-admin.vercel.app`    | Render / trusted packaging shell |
| `VERCEL_API_ORIGIN`                          | Pending the Render service's HTTPS URL  | Trusted packaging shell only     |

Use these exact origins without trailing slashes. The existing Vercel aliases and project links were confirmed on 2026-10-04. `VERCEL_API_ORIGIN` cannot be filled until Render assigns the service URL. Do not place Neon or email credentials in either frontend project.

`TEST_DATABASE_URL` is only for a dedicated local test database. The tests may reset it. `DEMO_*` variables are optional seed credentials. On a new production database, `DEMO_ADMIN_EMAIL` and `DEMO_ADMIN_PASSWORD` may be set temporarily in a trusted migration shell for the one-time `npm run db:seed` command to create the first super administrator. Leave `DEMO_EMAIL` and `DEMO_PASSWORD` unset in production, and remove the bootstrap admin credentials after seeding. `CRON_SECRET` belongs to the legacy Vercel API path. The existing private Vercel Blob storage also works on Render when its token is configured there. Standalone production startup requires either that token or an absolute `UPLOAD_DIR` on an attached disk. No JWT secret is needed: MIRHAL uses opaque database sessions.

Set Render values in **Dashboard → Web Service → Environment**. Set the Vercel packaging variables in your local deployment shell or ignored local `.env` before `npm run vercel:package:render`. This command rejects missing or malformed HTTPS origins before writing deployment artifacts. If Vercel builds from Git instead of prebuilt artifacts, the packaging process needs to run in its build workflow with those public origins. Never put private API variables in Vercel.

The current customer Vercel project still has legacy API variables (`DATABASE_URL`, `BLOB_READ_WRITE_TOKEN`, and `CRON_SECRET`) because it hosts the old Vercel API function. Keep that release working until the Render cutover passes live checks. Then remove those private variables from the frontend project. Put `BLOB_READ_WRITE_TOKEN` on Render first if continuing to use the private Blob store.
