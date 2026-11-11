# Database

`prisma/schema.prisma` defines the normalized relational model. Migration SQL adds checks and immutability triggers not expressible in Prisma. Apply migrations with `db:deploy`; develop new migrations with `db:migrate`. Never reset shared Neon or manually edit deployed schemas. Runtime uses the pooled `DATABASE_URL`; CLI migrations use `DIRECT_URL`.

The initial migration creates all domain relations. The integrity migration enforces positive amounts, bounded progress/mood/energy, ordered challenge dates, no self-friendship and one milestone parent. It makes XP/audit append-only and freezes challenge rules/baselines/results. The snapshot migration backfills eligible habits/timezones and freezes eligibility, scoring configuration and metrics. Existing final seeded results are preserved; a backfill cannot reconstruct unrecorded historical habit edits.

Important uniqueness rules include one habit log per habit/calendar day, one check-in per user/day, one participant per challenge/user, one final score per participant/challenge, one friendship per sorted pair, one achievement unlock per user/achievement, and globally unique XP/redemption idempotency keys.

Indexes follow list patterns: user/status, habit/date, due dates, project/goal foreign keys, challenge state/timing, notification read state, feedback status/category and audit timestamps. Avoid adding indexes without an actual query pattern. JSON is reserved for flexible analytic/audit/XP metadata.

Account deletion cancels unfinished shared challenges, rechecks the active account/password under its lock, and erases personal free text, reflections, experiments, feedback attachments/replies, analytics and social connections, invalidates identity and sessions, and anonymizes retained domain records. Minimal pseudonymous append-only XP, audit and challenge evidence remains for integrity. A production retention/purge policy must be chosen explicitly for the deployment jurisdiction.

Local integration tests deploy migrations into a `_test` database. E2E uses a separate test database. `db:check-migrations` replays SQL into an isolated local shadow database and compares it with the Prisma schema.

Migration four adds `QuestTemplate` and ordered `QuestTemplateItem` records for optional staff-published missions. Users copy templates into their own independent quests; editing a template never rewrites existing user work. Avatar presets and private screenshot metadata use the original profile/feedback models.

`core/habit-streaks.ts` calculates complete daily/custom/weekly runs with indexed log evidence and SQL window functions. Client list payloads keep only recent logs; a long streak is not limited by the display window.

Migration five enforces ordered start/end dates for goals, projects and tasks. The API validates merged PATCH values before writing; equal dates and optional open-ended plans remain valid. Project moves cannot silently leave tasks explicitly linked to a different goal.

The former serverless rate-limit bucket table is removed by the forward migration `202611110001_remove_rate_limit_bucket`; the historical create migration remains immutable. Migration seven (`20260928180000_audit_query_indexes`) adds nine indexes for milestone/task parents, feedback conversation children, challenge evidence by user/time, and expired session/token cleanup. Migration eight adds `AttachmentDeletion`, an indexed outbox of opaque file keys scheduled transactionally during account erasure. Migration nine (`202610020001_reward_preferences`) adds reward cooldown/time contexts, optional redemption ratings, favorites and savings targets without changing existing XP or redemption rows. The current migration set includes the forward removal migration; no production data was reset or migrated during this work.

Both configured Neon URLs were checked read-only, and their external TLS handshake verified TLS 1.3. Neon terminates TLS at its edge, so backend `pg_stat_ssl` alone does not describe client-to-Neon transport. Connection strings and certificates are not included in audit documentation.

Prisma stores these `DateTime` fields as UTC `timestamp` values. Raw SQL explicitly casts ISO UTC timestamp text and literal calendar dates, so streaks and monthly XP do not change when a database session uses a different timezone. Regression tests exercise both `Pacific/Honolulu` and `Africa/Cairo`.

Attachment metadata disappears as part of erasure while its storage keys remain in the private cleanup outbox. Successful idempotent removal deletes the queue row; failures retain it with a delayed retry time. Standalone maintenance runs every minute and Vercel uses the existing authenticated scheduled-maintenance endpoint. The queue has a bounded batch and an index on retry/creation time. Set a cleanup/retention service level appropriate to the deployment cron schedule.
