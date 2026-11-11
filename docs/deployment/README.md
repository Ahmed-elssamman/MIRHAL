# MIRHAL deployment: Vercel + Render + Neon

Start with the [operator setup runbook](operator-setup.md) for the remaining Render, Resend, DNS, and Vercel steps. The [environment checklist](environment.md) lists every variable and its placement. Read-only checks on 2026-10-30 found the reachable `https://mirhal-web.vercel.app/api/auth/capabilities` reporting `emailDelivery: false`; production email is not currently available through that route.

## Local

1. Use Node 24.21.0 and run `npm ci`.
2. Copy `.env.example` to `.env`. Set `DATABASE_URL` and `DIRECT_URL` to local PostgreSQL. `npm run db:local` can create isolated local databases when PostgreSQL binaries are available.
3. Run `npm run db:generate`, `npm run db:deploy`, then `npm run db:seed` if you want reference data.
4. Set `EMAIL_PROVIDER=file` to inspect messages under `.local/mail`. For real local Gmail delivery use the SMTP values in [email-provider.md](email-provider.md) and a Google App Password.
5. Start the API with `npm run dev:api`, customer app with `npm run dev:web`, and admin app with `npm run dev:admin`. The apps use ports 3333, 4200, and 4201.
6. Open `http://localhost:3333/api/health`, register, verify a local email link, request a reset, log in, and switch language. The browser proxies `/api` to the local API.

## Neon

1. The existing Neon database was confirmed as the production target on 2026-10-04. Copy its pooled connection URL to Render `DATABASE_URL` and direct URL to Render `DIRECT_URL`. Require TLS as Neon instructs.
2. Four reviewed Arabic migrations were applied with `npm run db:deploy` after a restricted local backup; Prisma now reports the production schema up to date. For future releases, review the target and run `npm run db:deploy` from a trusted environment before deploying code. Never run `db:migrate` or reset against production.
3. Run `npm run db:generate` at build time; the Render blueprint already does so.
4. The confirmed production database already contains the shipped reference achievements, rewards, quest template, and season phases. Do not rerun `npm run db:seed` simply because the Arabic migrations were applied. For a genuinely new installation, run it once from a trusted environment; set a private `DEMO_ADMIN_EMAIL` and strong `DEMO_ADMIN_PASSWORD` only for that command to create the first super administrator. Leave `DEMO_EMAIL` and `DEMO_PASSWORD` unset, and remove the bootstrap credentials afterward.
5. After the additive Arabic quest-template migration, review any older custom quest templates in the admin app. Add Arabic descriptions and steps; templates without complete Arabic copy are hidden from Arabic customers until translated. The shipped reference template is backfilled by the migration.
6. Review older custom achievements and announcements in the admin editor. Add Arabic copy for each. The shipped achievements and season phases are backfilled; announcements without Arabic copy stay hidden on Arabic dashboards.
7. Review older shared catalog rewards and add Arabic titles, descriptions, and categories. The four shipped rewards are backfilled. Existing untranslated shared rewards use Arabic placeholders until edited. An aggregate production check after migration found no currently untranslated records in the audited quest template, achievement, season phase, announcement, or shared reward tables; future editorial records still need both languages.

## Render API

Use [render.yaml](../../render.yaml) as the web service blueprint. It runs `npm ci --include=dev && npm run db:generate && npm run build:api`, then `npm run start:prod`. The health check is `/api/health`. Staff can inspect provider configuration without sending mail at `/api/admin/health`; this reports configured, disabled, or incomplete and does not verify real delivery. Configure variables from [environment.md](environment.md). The API listens on Render's `PORT` and `0.0.0.0`; Nest shutdown hooks disconnect Prisma. Exact Vercel origins are required for CORS. The API has no public Swagger endpoint in production.

The blueprint selects Render Free. A free service may sleep when idle; the first API request after sleep can be slow. Background challenge, attachment, and expired-record maintenance runs in the standalone API process only while it is awake. Continuous availability and reliably timed work require a non-sleeping service or a proper scheduled worker. Feedback screenshots are stored in PostgreSQL, with a 100 MiB shared attachment limit and a 2 MiB per-file limit. Monitor database capacity and backup usage independently of this application quota.

### Request abuse protection

The API no longer applies request-level rate limiting and has no Redis dependency. Login, registration, password recovery, email verification, and invitation routes therefore have greater exposure to automated abuse and brute-force traffic. Keep authentication, authorization, DTO validation, and the account-level email-token issuance budget in place. The email-token budget is a domain rule, not an HTTP request limiter. Browser event throttling would not protect these API routes.

### Background Worker & Transactional Outbox

The repository contains an `OutboxJob` scheduler and worker, but the current authentication, invitation, and in-app notification flows call their providers directly and do not schedule jobs through this outbox. Do not assume transactional email retries or crash recovery are provided by the worker. A worker interruption can also leave a claimed job in `PROCESSING`; inspect such jobs before manually retrying because an email provider may already have accepted a send.

- **Dedicated Worker Service**: On Render or any container host, launch `npm run worker` as a background worker process.
- **Scheduled / Serverless Batch**: Run `npm run worker -- --once` or invoke the authenticated `/api/internal/maintenance` endpoint on a periodic schedule (e.g. Render Cron or external cron).

## Vercel customer and admin

The browser keeps calling relative `/api`, preserving host scoped HttpOnly cookies. The older documented aliases `https://lifequest-web-cyan.vercel.app` and `https://lifequest-admin.vercel.app` returned 404 on 2026-10-30; `https://mirhal-web.vercel.app` returned 200 and `https://mirhal-admin.vercel.app` returned 404. Confirm the intended projects and current aliases in Vercel before packaging. Set `VERCEL_WEB_ORIGIN`, `VERCEL_ADMIN_ORIGIN`, and `VERCEL_API_ORIGIN` to those verified exact HTTPS origins without trailing slashes in the trusted packaging shell, then run `npm run vercel:package:render`. This command requires all three origins and will not build the older Vercel API function if the Render origin is missing. The web artifact routes `/api/*` to the Render API; admin routes through the customer origin. Public pages are prerendered; other customer routes use the client shell. Check the ignored `.local/vercel/web` and `.local/vercel/admin` project links before any deployment. After owner review, deploy the generated prebuilt output with:

```bash
vercel deploy --prebuilt --prod --yes --cwd .local/vercel/web
vercel deploy --prebuilt --prod --yes --cwd .local/vercel/admin
```

Do not run `npm run vercel:configure` for this split deployment; it configures the old bundled Vercel API and disables email. Review the generated routes and test before production deployment. PostgreSQL stores feedback attachments; the Render API does not require a Blob token.

## Email and checks

Use Resend on Render as described in [email-provider.md](email-provider.md). Run `npm run typecheck`, `npm run lint`, `npm run test`, `npm run test:frontend`, `npm run test:integration`, `npm run db:validate`, `npm run db:check-migrations`, `npm run build`, `npm run test:ssr`, `npm run test:e2e`, and `npm run security:check` before release. After deployment, follow the [production smoke test](smoke.md) for health, API routing, cookie login, both languages, verification, reset, sender DNS, storage, and proxy behavior.

## Troubleshooting

- **CORS or 403:** confirm Render `WEB_ORIGIN` and `ADMIN_ORIGIN` exactly match browser origins, including scheme and no trailing path. The browser must use the Vercel `/api` route.
- **401 after login:** inspect the Vercel rewrite, host scoped cookie, HTTPS, and forwarded `Set-Cookie`; test in a real browser.
- **Database failure:** check pooled/direct Neon URLs, TLS, network access, and applied migrations. The health endpoint queries the DB.
- **Slow first request:** Render Free may be waking from sleep. Use an always-on plan for a latency guarantee.
- **Email failure:** check `EMAIL_PROVIDER`, `SMTP_FROM`, Resend key, domain verification, and provider dashboard. For Gmail, use an App Password and port 465 with TLS.
- **Startup failure:** inspect Render logs for the safe startup code and check required variables. Secrets are never printed.
