# MIRHAL migration baseline

Date: 2 October 2026. This is a snapshot of the **existing working tree**, which already contains many uncommitted changes. Those changes are preserved. The earlier [production readiness audit](final-audit.md) provides a detailed review of the current implementation; this report records the migration-specific baseline and commands rerun here.

## Repository architecture and conventions

- Nx/npm modular monolith: `apps/web` and `apps/admin` are separate Angular 21 standalone applications; `apps/api` is a NestJS 11 REST API. There are eight shared libraries: `auth`, `config`, `contracts`, `data-access`, `domain`, `forms`, `ui`, `utilities`.
- The customer app has lazy routes for landing, help, authentication, onboarding, dashboard, Today, goals, projects, tasks, habits, quests, Habit Lab, journey, rewards, achievements, challenges, friends, analytics, profile, settings, feedback and notifications. Admin has separate protected routes for overview, users, content, quests, challenges, analytics, feedback, audit, settings and health.
- Angular features use OnPush, signals/computed for local state, typed reactive forms and shared resource/error helpers. `Preferences` supplies bilingual English/Arabic text and RTL/LTR. Tailwind 4 tokens, shared UI primitives, Lucide icons and PrimeNG 21 are established. Public landing/help are prerendered; private routes use guards; the customer app has a service worker that excludes private API traffic.
- API controllers use shared strict Zod contracts, session and role guards, explicit ownership checks, rate limits and transaction-aware domain services. The backend's domains are auth, planning, habits/check-ins/quests, XP/rewards, social challenges and admin. The API is a single Nest module with domain services, not separate Nest feature modules; changing that alone offers no migration benefit.
- Prisma 6 is the schema source. PostgreSQL/Neon holds normalized goals, projects, tasks, habits/logs, check-ins, quests, seasons, XP ledger, achievements, rewards/redemptions, social challenges, feedback, content and audit data. Eight existing migrations include check constraints, append-only XP/audit triggers, challenge snapshot immutability, rate-limit storage, query indexes and attachment cleanup. Unique habit/day and check-in/day constraints, idempotency keys and owned foreign keys matter for every extension. Migration SQL/function names containing `lifequest` are deployed identifiers and must remain stable.
- Deployment uses Vercel packaging, a customer site/API and separate admin site. `.env` exists and is ignored; `.env.example` documents server credentials and isolated test databases. CI uses PostgreSQL. No Docker application deployment is present.

## Current product inventory

| Capability          | Current implementation                                                                                                                                                                   |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Onboarding          | Seven illustrated steps; area, optional goal/habit, routine and visibility are submitted at the end. Existing guard and API persist completion.                                          |
| Home / Today        | Dashboard aggregates progress and announcements; Today separately loads paginated scheduled habits and due tasks plus check-ins. The shell currently exposes many domain routes at once. |
| Planning            | Goals, projects, tasks, milestones and unsaved-form protection; quests and staff templates remain distinct.                                                                              |
| Behavior / recovery | Schedules, habit logs, day-level check-ins and Habit Lab experiments/diagnosis already exist.                                                                                            |
| Progress            | XP append-only ledger, levels, achievements, streaks, month journey and analytics. Challenge scoring is separate from XP.                                                                |
| Rewards             | Global and personal rewards, category string, XP cost, redemption limits, history, atomic spend and five-minute undo. Preference learning, feedback and savings targets are absent.      |
| Social / privacy    | Friends and six challenge modes, consented sharing, score snapshots and server authorization.                                                                                            |
| Help / admin        | Interactive bilingual help walkthrough and full separate admin app with users, content, analytics, challenges, feedback and audit.                                                       |

## Baseline checks

| Command                       | Result before product changes                                                                                                                                                                                                              |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run typecheck`           | Passed: API, web and admin.                                                                                                                                                                                                                |
| `npm run lint`                | Passed.                                                                                                                                                                                                                                    |
| `npm test`                    | Passed: 32 tests in 3 files; Vite native-loader compatibility warning.                                                                                                                                                                     |
| `npm run test:frontend`       | Passed: 31 tests in 6 files; harmless NO_COLOR/FORCE_COLOR warnings.                                                                                                                                                                       |
| `npm run build`               | Passed: all three projects; public app prerendered 2 routes.                                                                                                                                                                               |
| `npm run db:validate`         | Passed; Prisma package.json configuration deprecation warning.                                                                                                                                                                             |
| `npm run test:integration`    | Initial attempt failed before tests because local PostgreSQL on `127.0.0.1:55432` was stopped; 66 tests skipped by runner. Started the repository's existing local test database via `npm run db:local`; rerun passed 66 tests in 5 files. |
| `npm run db:check-migrations` | Initial attempt could not connect to the stopped local database. Rerun passed: Prisma schema matches complete migration history.                                                                                                           |
| `npm run test:e2e -- --list`  | Passed: 12 Chromium tests discovered.                                                                                                                                                                                                      |
| `npm run test:e2e`            | Passed: 12 Chromium tests in 2.4 minutes, covering core journey, admin, RTL/LTR, mobile/accessibility, planning, challenges, recovery and error retry.                                                                                     |

## Risks, debt and conflicts

- Working tree is substantially dirty, including security, database and test files. Do not reset, overwrite or commit user work as a migration checkpoint.
- `@mirhal/*` TypeScript aliases, `lq-` selectors, local database names, test filenames, deployed URLs and old migration function names are technical contracts. Cosmetic renaming would create unnecessary risk. User-visible brand strings and metadata can change safely without changing them.
- Existing Today and Habit Lab already solve part of the target product. The largest UX gap is navigation and a single clear next action, rather than missing domains.
- The current onboarding has seven steps; shorten only after checking completion semantics and existing E2E assertions.
- Reward personalization needs an additive schema migration and clear ownership/privacy behavior. No need for ML or an external queue.
- Future health providers should be documented first; no existing provider or credentials were found. Avoid speculative data tables until a concrete ingestion contract exists.
- Database-backed tests and browser QA depend on the local isolated PostgreSQL instance. Do not run migration/reset commands against Neon or a shared database.

# Deployment baseline update

The pre-change deployment and email baseline for 2026-10-04 is recorded in [the deployment baseline](../deployment/baseline.md). It includes architecture, checks, warnings, blockers, and pre-existing issues.
