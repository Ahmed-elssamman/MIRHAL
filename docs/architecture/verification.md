# Historical verification record — 26 September 2026

> This record describes an earlier revision/deployment. It is superseded for current source verification by the [28 September final audit](../audit/final-audit.md). Its old dependency pairing, test counts and release claims are retained as historical evidence only.

Verified on 26 September 2026 against production builds, isolated local PostgreSQL fixtures, and the running development applications connected to the configured Neon database. These are observed results for this workspace, not a certification for every browser or deployment.

## Automated checks

| Check                                                    | Result                      |
| -------------------------------------------------------- | --------------------------- |
| Domain and contract Vitest tests                         | 32 passing                  |
| Angular Vitest/jsdom tests                               | 28 passing                  |
| NestJS/Prisma/Supertest integration tests                | 49 passing                  |
| Playwright production browser suites                     | 11 passing                  |
| Formatting, ESLint and strict type checks                | Passing                     |
| Prisma validation and migration replay/schema comparison | Passing                     |
| Production web, admin and API builds                     | Passing                     |
| Public SSR and cache policy                              | Passing                     |
| Production dependency audit                              | No reported vulnerabilities |
| Configured-secret source scan                            | Passing                     |
| Running customer/admin/database smoke checks             | Passing                     |

Six versioned migrations are deployed to the configured Neon database. Integration fixtures use a local database ending in `_test`; browser tests create a separate random `mirhal_e2e_*_test` database. Neither resets Neon data. The live smoke check signs in with environment-configured development accounts and reads seven customer routes and six admin routes. It checks database health, browser errors and 320px overflow.

## Coverage

| Instrumented scope   | Statements | Branches | Functions |  Lines |
| -------------------- | ---------: | -------: | --------: | -----: |
| Domain and contracts |     98.91% |     100% |    97.87% | 98.68% |
| API                  |     89.29% |   74.26% |    94.21% | 90.77% |

Thresholds enforce 80% statements/functions/lines and 70% branches in those scopes. Frontend unit tests cover shared state, HTTP, guards, validation, preferences, accessible primitives and schedule controls. They do not establish 80% coverage of all frontend source. Playwright additionally covers the critical customer and operational workflows.

## Browser acceptance

The eleven suites cover registration/onboarding; goals/projects/tasks; habits, minimum actions and check-ins; quests, XP and rewards; private feedback attachments; administration and audit trails; friends and actual server-scored challenge completion; staff quest templates; unsaved forms; schedule/commitment experiments; temporary API failure/retry; advanced planning fields; project milestones; and subtasks that retain their parent after reload.

Layout checks cover 320, 360, 390, 412, 768, 1024, 1280 and 1440 CSS pixels. Seventeen customer routes and thirteen admin routes run axe checks with WCAG A/AA tags in English/light desktop and saved Arabic/dark at 320px. The Habit Lab dialog has an additional mobile accessibility check. Reduced motion, document language/direction, deferred analytics and named keyboard-scrollable admin tables are exercised. These automated checks supplement visual review; they are not a formal WCAG certification.

## Performance and delivery

The customer initial bundle is 549.91 kB raw / 141.68 kB estimated transfer. Administration is 524.45 kB raw / 133.89 kB estimated transfer. Both pass the 550 kB warning budget. Features, overlays and celebration components are lazy/deferred; the analytics chart belongs to the lazy analytics route. Admin features have separate entry points and output directories and are not imported into customer code.

The final Chromium sample used production builds, disabled browser cache, 4x CPU throttling and no network throttle on this shared development machine. Dashboard readiness was 1,207 ms; LCP 680 ms; CLS 0; DOMContentLoaded 254 ms; load 263 ms. Resources transferred 793,921 bytes. The page issued one dashboard request, plus session and announcement reads. This is a local laboratory sample, not a field percentile or mobile-network benchmark.

`npm run test:ssr` starts the built SSR server and verifies public headings for `/` and `/help`, HTML/service-worker revalidation, and immutable caching only for hashed bundles. Private API responses use `no-store`. PWA caching covers the shell and visited static chunks; private responses and mutations are never cached or replayed.

## Running applications and operational limits

The customer application is on port 4200, administration on 4201, and API on 3333. `node tools/browser-smoke.mjs` verified both applications against the configured runtime database without editing personal work. Public SSR is independently verified from production output.

Angular 21 + PrimeNG 19 matches the requested major versions but uses peer overrides outside PrimeNG's declared support range; see ADR 001. The Vercel deployment intentionally disables email delivery; private screenshots use private Vercel Blob storage. Historical monthly logs/check-ins/XP are date-bounded, while goal/project progress and habit schedules use current configuration and disclose that limit in the UI. Existing notification text retains its delivery language. The customer/API and separate administration application are deployed to Vercel. See [Vercel deployment](vercel.md).

Ignored evidence includes `.local/e2e-acceptance.log`, `.local/build-acceptance.log`, `.local/live-smoke-final.log`, `.local/performance.json`, `.local/screenshots/`, `coverage/` and `playwright-report/`. These can contain private fixture data and are not published assets.

## Vercel acceptance

Both production aliases return healthy API/database responses. Live Chromium verification passed registration, secure HttpOnly session cookies, onboarding, linked goal/project/task creation, habit completion, check-in, quest completion, XP reward redemption, private image upload/download, anonymous download rejection, profile/monthly reflection persistence, unsaved-edit protection, admin login, user inspection, and an admin feedback reply. Its temporary user and uploaded image were removed afterward. Seeded smoke checks additionally read seven customer pages and six administration pages. The Today layout had no horizontal overflow at 320, 360, 390, 412, 768, 1024, 1280 and 1440 pixels.

Live testing exposed a reference-data race: opening a creation dialog before life areas loaded left its required area empty. Goal, habit and quest creation now wait for the shared request, explain unavailable data, and retry correctly. Six additional frontend tests cover loading and failure/retry behavior.

Public `/` and `/help` contain prerendered headings. Private routes return the client shell. Live HTML revalidates and hashed assets use one-year immutable caching. Four individual HTML-plus-asset request samples took 323–729 ms from this workspace; these are diagnostic samples, not browser LCP measurements or field percentiles. Separate customer/admin initial bundle sizes remain 549.91 kB and 524.45 kB raw. The traced API function is 23.9 MiB uncompressed and includes the Linux Prisma/Argon2 bindings. A scan of 1,474 packaged text assets found no configured secret values.

The real maintenance endpoint rejected unauthenticated access (401) and accepted its private bearer credential (200). The disabled-mail capability is public and accurate. Shared rate-limit atomicity, disabled-mail registration/recovery behavior and cron authentication have four new integration tests. Production dependency audit reports zero known vulnerabilities.

Ignored deployment evidence lives in `.local/vercel-verify.log`, `.local/vercel-browser.log`, `.local/vercel-delivery.json`, `.local/deploy-*.log`, and `.local/vercel/`. Deployment directories contain private CLI state and must never be committed.
