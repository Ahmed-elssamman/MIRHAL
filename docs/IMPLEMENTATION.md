# MIRHAL implementation record

## Implemented

MIRHAL now has separate Angular 21 customer and administration applications, a NestJS API, and an Nx 22.7 workspace with explicit shared-library projects. Strict TypeScript, signals, lazy feature routes, Tailwind and supported PrimeNG 21 peers are in place. npm and its lockfile are preserved.

Neon runtime and direct connections live only in ignored `.env`. Six versioned migrations were observed on Neon, including immutable challenge snapshots, relational quest templates, and shared serverless rate limits. Three additive migrations add query indexes, a durable attachment-deletion outbox and reward preferences/savings; all nine migrations replay locally and the new three await release to Neon. Development seed data is deterministic. Integration and browser tests use separate local PostgreSQL databases, never Neon.

Customer workflows include registration/sign-in/recovery/verification, short onboarding and privacy settings; linked goals, milestones, projects and subtasks with advanced dates, priorities, notes, units and lifecycle settings; daily/weekly/custom habits, minimum actions and schedule-aware Habit Lab experiments with repeated-miss suggestions; check-ins, weekly quests and editable staff-published templates; append-only XP, levels, achievements, personal reward editing, favorites, savings targets, optional ratings, deterministic suggestions and reward redemption/refund; friendships and private deterministic challenges; notifications, feedback with private screenshots, profile/avatar choices, monthly reflection/history and analytics. Today offers one next action from due tasks, scheduled habits or a lazily loaded active quest.

Administration includes user lookup/details/status/roles, activity and planning aggregates, schedule-based habit adherence, recovery experiment counts, challenge moderation, feedback triage/internal notes/replies/attachments, quest templates, content catalogs, health/configuration and append-only audits. Operations use server RBAC. Catalogs and private timelines have pagination; reference/summary endpoints intentionally return bounded selections.

Shared forms show client/server field errors, associate errors with inputs, and protect unsaved core edits on dialog close, navigation and browser exit. English/Arabic, RTL, light/dark/system theme, reduced motion, mobile bottom navigation, responsive dialogs and keyboard access are implemented. Local avatar assets make no third-party requests. Header language changes persist to the profile, and server-confirmed level changes use a deferred, dismissible celebration. Today selects eligible schedules and work before pagination in the account timezone.

## Integrity and privacy

- XP/redemption/habit/quest workflows use transactions and idempotency constraints. Personal mutations recheck active account status while holding the user lock. Staff writes recheck permissions under locks; staff access changes lock users in deterministic order.
- Challenge activation freezes eligible habits, schedules, units, reward caps, metric configuration, timezone and improvement baselines. New version 2 challenges score frozen habit points independently of XP; existing version 1 agreements retain their original semantics. Results are deterministic, versioned and immutable once final. Missing observations cannot improve a lower-is-better score. Cooperative totals respect sharing permissions and blocked connections.
- Long habit streaks are calculated from complete indexed evidence in PostgreSQL rather than truncated client history. Unit/domain and integration cases cover daily, custom and weekly schedules, including a 1,100-day history.
- Profiles, notes, check-ins and exact behavioral logs stay private. Account deletion cancels unfinished challenges and erases personal content and screenshot files, invalidates sessions and pseudonymizes retained integrity evidence. Exports are audited.
- Screenshot uploads accept PNG/JPEG signatures, enforce 2 MB and three-image limits, use private randomized storage keys, require ownership or support authorization to download, force attachment disposition, and persist bytes in PostgreSQL.
- Argon2id passwords, hashed opaque sessions/recovery tokens, HttpOnly cookies, strict origins, Helmet, rate limits, validated DTOs, safe errors and request IDs are implemented. Production email uses configurable TLS SMTP; development messages stay in ignored private files.

## Verification

The latest verification report is in `docs/audit/final-audit.md`. Commands and test environments are documented in the README and testing guide. Browser suites exercise production builds, both applications, critical business flows, attachments, unsaved edits, real short-duration challenge completion, responsive widths and axe checks.

Ignored local artifacts include build/test logs, browser screenshots/traces, coverage, private development email and fixture credentials. These must never be committed or published.

## Deliberate operational limits

- Angular 21 + PrimeNG 21 uses supported peers. Old Angular peer overrides and unused Angular animations/theme presets were removed; see ADR 001.
- Historical monthly logs, check-ins and XP use the selected calendar month. Goal/project progress and adherence schedules use current configuration; the UI discloses this rather than presenting reconstructed historical facts.
- Offline support caches the application shell and visited static chunks. Private API data and mutations are never cached or replayed.
- Screenshot bytes are stored in PostgreSQL with API authorization. Self-hosted installations need database backups and a deployment-specific retention policy.
- Profile images currently use local landscape presets or initials. External image URLs and arbitrary avatar uploads are intentionally unsupported.
- Challenge notifications are delivered through in-app reads and the simple lifecycle worker. Redis and WebSockets are not needed for the implemented interaction model.
- The previous customer/API and separate administration release is on Vercel; the MIRHAL migration and three pending migrations are locally verified but not deployed. Email delivery is explicitly disabled on the existing release. SMTP credentials, legal retention settings and deployment automation remain environment-specific; see the deployment guide.
