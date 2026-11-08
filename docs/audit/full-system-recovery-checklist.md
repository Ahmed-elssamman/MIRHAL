# MIRHAL full-system recovery

Audit date: 2026-11-04. No production settings, secrets, databases, or deployments were changed. The local `.env` was preserved; a separate ignored `.env.local` was created from the checked-in local template.

## Initial Git state

- Initial worktree was clean.
- Initial branch: `feat-/-make-mobile-view-by-PWA` at `52cf773c3d618f379f237fe0ad3b9da9d83cdd11`, tracking the same remote commit.
- Initial local `main`: six commits behind `origin/main` (`95ea680c8d6ab3dbe849be1567ad5ed47fb6d397`). It was safely fast-forwarded; local `main`, `origin/main`, and `origin/HEAD` now all point at `95ea680c8d6ab3dbe849be1567ad5ed47fb6d397`.
- No local or remote feature branch has commits absent from `origin/main`. Remote migration and API branches are already included in main history; the mobile branch is one commit behind main. No branch merge was needed.
- `gh auth status` reports an invalid saved token. GitHub PR state, branch protection, and CI could not be queried; no push or PR action was attempted.

## Audit status

| Area                      | Status   | Evidence                                                                                                                                                                                                                                                                                                                      | Required action                                                                                                                                                                  |
| ------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Email service             | PARTIAL  | Mocked Resend/SMTP, bilingual templates, idempotency, transient retry and provider failure coverage pass in integration suite. Production `/api/auth/capabilities` returns `emailDelivery:false`; no authorized test recipient was supplied.                                                                                  | Configure/enable the intended provider in the active production API and run a consented delivery check.                                                                          |
| API                       | PARTIAL  | Local API health returned 200. Render build log succeeds, but newest production deploy fails at startup because `REDIS_URL` is missing. The previous live service woke and returned health 200 after 13.59 seconds.                                                                                                           | Configure a managed Redis URL in Render and redeploy through the reviewed workflow.                                                                                              |
| Web                       | PARTIAL  | Local web and `/api` proxy returned 200. Production web domain returned 200. Latest Vercel main deployment (`95ea680`) is Error; logs show TypeScript errors from stale generated Prisma types.                                                                                                                               | Verify the next Vercel build after adding Prisma generation to the npm build lifecycle; confirm production artifact routing.                                                     |
| Local API connectivity    | VERIFIED | API, web, and admin started from `npm run dev`; local health and frontend proxy returned 200. Local registration, authenticated `/me`, life-area retrieval, task create and task update all succeeded through the web proxy.                                                                                                  | No additional action for the verified local stack. Hybrid mode is documented but was not exercised against production data.                                                      |
| Performance               | PARTIAL  | Isolated dashboard benchmark: 17 queries for both 1 and 100 habits; summary response 3,964 B and 6,343 B respectively. 1 habit: 16–41 ms (median 19 ms); 100 habits: 131–165 ms (median 136 ms).                                                                                                                              | Capture production latency and browser route timings after deployment. The benchmark has no saved before-fix baseline.                                                           |
| Global loader             | VERIFIED | Existing component uses the checked-in MIRHAL mark, supports light/dark surfaces and reduced motion, and only tracks explicitly global requests. Delay/minimum visibility are centralized; fast-operation and blocking-loader frontend tests pass.                                                                            | No visual rewrite was justified by current implementation/tests.                                                                                                                 |
| Environment configuration | PARTIAL  | `.env.local.example` now uses loopback PostgreSQL and a safe local-only launcher guard. `.env.local` was created without touching ignored `.env`. Local mode was exercised. Hybrid mode requires HTTPS and is documented.                                                                                                     | Owner must select production `API_ORIGIN` for hybrid development; credentials for a real production login were not supplied.                                                     |
| Git branches              | PARTIAL  | Local main now equals origin/main at `95ea680…`; all inspected branch commit sets are contained in main.                                                                                                                                                                                                                      | Re-authenticate GitHub CLI to confirm PR/CI/protection metadata and publish workspace fixes using the approved repository workflow.                                              |
| Render                    | BROKEN   | Service `MIRHAL` is connected to `main`, auto-deploys, and has `/api/health`. Latest deployed commit `95ea680…` has `update_failed`; startup logs say required `REDIS_URL` is missing. Blueprint incorrectly said `RATE_LIMIT_MODE=memory`; corrected locally to `redis`.                                                     | Set `REDIS_URL` in Render (owner-managed secret/configuration), reconcile the blueprint, redeploy, and verify. Provisioning Redis may create cost and was not attempted.         |
| Vercel                    | BROKEN   | `mirhal-web` and `mirhal-admin` latest production deployments are Error at commit `95ea680…`; web build logs show ungenerated Prisma Client TypeScript errors. Web domain returns 200; `mirhal-admin.vercel.app` returns 404. Project settings have no explicit build/output commands; auto deploys run root `npm run build`. | Verify builds after the new `prebuild` hook; inspect project routing/aliases and use the documented reviewed Build Output API packaging path. No platform settings were changed. |

## Changes made

- Added `prebuild` Prisma Client generation so the Vercel auto-build path no longer depends on npm install lifecycle scripts running.
- Corrected Render blueprint rate-limit mode to `redis` and clarified `.env.example` production requirements. This does not supply the required Render secret/connection URL.
- Added `.env.local`-only launch, migration, and seed commands with a localhost:55432 database guard. Hybrid mode starts only web/admin and requires an HTTPS API origin. Updated the local template and README; added `docs/deployment/local-development.md`.
- Made expired-invitation status updates conditional/atomic and fixed the corresponding test mock/import.
- Replaced relative UI library imports in the app root with configured Nx aliases, resolving two existing module-boundary lint errors.
- Updated mock log callbacks to satisfy the no-empty-function lint rule.

## Deployment evidence

- Render service: `srv-dbgq9u6c6qcc73ccb29g`, URL `https://mirhal.onrender.com`, branch `main`, latest failed commit `95ea680c8d6ab3dbe849be1567ad5ed47fb6d397`; previous live commit `485615d02a838d8f9ffd5108f109e61fc5d30920`.
- Render public health: HTTP 200 after a 13.59 s wake-up. The public API reports email delivery disabled.
- Vercel latest web deployment: `dpl_GYq9zYBi1vQYeZaKN3SyigzmfRsD`, Error, commit `95ea680`.
- Vercel latest admin deployment: `dpl_4FpxJqYwAjsntJ83c3BLK9RAbj17`, Error, same commit.
- Vercel public web URL returned HTTP 200; expected admin alias returned HTTP 404.
- Environment variable names/scopes were inspected without printing values. `mirhal-web` has Vercel/API origin names plus Blob store credentials. `mirhal-admin` has frontend origin names and backend-only production names including `DATABASE_URL`, `DIRECT_URL`, `TEST_DATABASE_URL`, `SMTP_*`, `DEMO_*`, and `CRON_SECRET`. Frontend source contains no references to these backend secrets. Their presence in the admin project's production build environment is unnecessary for the current Vercel-frontends/Render-API architecture; removal was not attempted because it changes production secrets/configuration.

## Verification

- `npm run db:generate` — passed.
- `npm run db:local` — passed; isolated localhost PostgreSQL provisioned.
- `npm run db:deploy:local` — passed; 18 migrations applied to local `lifequest`.
- `npm run db:seed:local` — passed.
- Local API/Web health, proxy, signup, authenticated GET, seeded data GET, task POST/PATCH — passed.
- `npm test` — passed, 51 tests.
- `npm run test:frontend` — passed, 87 tests.
- `npm run test:integration` — passed, 148 tests.
- `npm run test:performance` — passed; measurements above.
- `npm run typecheck` — passed.
- `npm run build` — passed; Angular reported a web initial-bundle warning: 613.82 kB vs 560 kB warning budget (158.54 kB estimated transfer). Admin also exceeded its 550 kB warning budget by 9.54 kB.
- `npm run test:ssr` — passed for public HTML, private shell routing, cache headers, and hashed assets.
- `npm run i18n:check` — passed; 1,308 aligned translation keys and zero raw template text nodes.
- `npm run db:validate` and `npm run db:check-migrations` — passed; Prisma schema matches the complete local migration history.
- `npm run security:check` — passed; no configured secret values were found in source or documentation.
- `npm run lint` — passed with 64 existing non-null assertion warnings; zero errors after the scoped lint fixes.
- Targeted Prettier check for modified files — passed.
- Real SMTP/Resend delivery, Vercel post-fix deployment, authenticated production CRUD, GitHub CI/protection inspection, and production performance measurements were not performed.

## Outstanding external blockers

1. Configure `REDIS_URL` in Render; the production API will not start without it. Do not use in-memory rate limiting in production.
2. Enable a real production email provider and provide an authorized test recipient for delivery verification.
3. Verify the latest Vercel build after this workspace’s Prisma prebuild fix; confirm admin domain and custom Build Output API routing.
4. Re-authenticate `gh` to inspect PR checks/protection and follow the repository’s authorized PR path for this workspace’s changes.
