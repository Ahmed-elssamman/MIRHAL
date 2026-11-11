# Backend Architecture

## System Overview & Architecture Principles

The MIRHAL backend is built with NestJS, Express, Prisma, and PostgreSQL. It enforces strict separation of concerns, fail-fast startup configuration, distinct authentication and authorization layers, durable transactional outbox background processing, and resilient mail delivery with circuit breaking.

The API contracts are the single source of truth for all consumers (`apps/web` customer frontend and `apps/admin` admin dashboard).

---

## 1. Modular Structure & Boundaries

The codebase is organized into domain and infrastructure feature modules:

- `common/config/` (`AppConfigModule`): Centralized, type-safe configuration. Validates environment variables at bootstrap using Zod schemas (`env.schema.ts`). Exposes scoped config namespaces (`app`, `database`, `auth`, `mail`, `storage`). Fails startup immediately with actionable error codes if mandatory variables are missing. Business services inject `ConfigService` rather than accessing `process.env` directly.
- `auth/` (`AuthModule`): Manages authentication, session tokens (Argon2id hashing), password recovery, and email verification.
- `mail/` (`MailModule`): Strategy-based mail delivery with a resilient Circuit Breaker.
- `notifications/` (`NotificationsModule`): User notifications and Transactional Outbox background processing.
- `admin/` (`AdminModule`): Staff operations, user moderation, announcements, and audit logging.
- `gamification/` (`GamificationModule`): XP ledgers, level progression, quests, achievements, and rewards.
- `social/` (`SocialModule`): Privacy-safe public profiles, social circles, activities, and challenges.
- `core/` (`CoreModule`): Health checks, feedback uploads, and core user preferences.

---

## 2. Authentication & Authorization (AuthN vs AuthZ)

Security responsibilities are decoupled across distinct guards:

1. **`SessionAuthGuard` (Authentication - AuthN)**:
   - Validates opaque session cookies against hashed database records.
   - Enforces session expiration (1-hour inactivity, 7-day absolute lifetime).
   - Attaches authenticated user identity (`id`, `role`, `email`, `isActive`) to `request.identity`.
   - Routes marked with `@Public()` bypass session checks.
2. **`RolesGuard` (Authorization - AuthZ / RBAC)**:
   - Evaluates route `@Roles(...)` metadata against `request.identity.role`.
   - Enforces strict hierarchical/role access (e.g. `admin`, `superadmin`).
   - Operates strictly after `SessionAuthGuard`.
3. **`AuthGuard`**:
   - Backward-compatible composite guard combining `SessionAuthGuard` and `RolesGuard` for legacy controllers.
4. **Object-Level Authorization**:
   - RBAC is complemented by domain-level ownership checks (`assertReferences`, explicit user ID filtering in transactions) to prevent insecure direct object references (IDOR).

---

## 3. Request Abuse Protection

The API does not apply request-level rate limiting and has no Redis dependency. This increases exposure of login, registration, password recovery, email verification, invitation, and other routes to brute-force attempts and automated abuse. Authentication, authorization, input validation, password hashing, request-size limits, and database constraints remain active. Email-token issuance retains a per-account business budget of five tokens per purpose per hour; this is separate from request-level rate limiting. Browser event throttling does not protect API routes.

---

## 4. Transactional Outbox & Background Processing

To keep HTTP request cycles fast and resilient, time-consuming operations (e.g., mail delivery, lifecycle evaluation) are decoupled from the HTTP lifecycle via the Transactional Outbox pattern:

- **Database Model**: `OutboxJob` tracks background jobs with statuses: `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`, `DEAD_LETTER`.
- **Atomic Enqueue**: Business mutations write outbox records within the same Prisma transaction using `OutboxService.schedule()`. Idempotency keys prevent duplicate jobs.
- **Worker Execution Modes**:
  - **Standalone Daemon**: Run `npm run worker` (or `npm run worker:dev`) in a dedicated container or long-running process.
  - **Cron / Maintenance Route**: `/api/internal/maintenance` triggers `OutboxWorker.processBatch()` periodically (e.g. via Render cron or Vercel cron).
  - **Single Batch Runner**: Run `npm run worker -- --once` for scheduled serverless tasks.
- **Retry & Backoff**: Exponential backoff (`baseBackoffMs * 2^(attempts-1)`) for transient failures, transitioning to `DEAD_LETTER` after reaching `maxRetries` (default 5).

---

## 5. Mail Strategy & Circuit Breaker

Mail delivery follows the Strategy and Factory patterns with an integrated Circuit Breaker:

- **`MailProvider` Interface**: Standardized contract with normalized `MailResult` and `DeliveryError`.
- **Provider Implementations**:
  - `ResendProvider`: Production HTTPS provider with built-in idempotency keys and transient network retry.
  - `SmtpProvider`: Reusable, lifecycle-managed Nodemailer transporter with connection pooling and verified TLS.
  - `FileProvider`: Development provider writing eml/json files locally to `.local/mail`.
  - `MemoryMailProvider`: In-memory test provider capturing sent messages without side effects.
- **Circuit Breaker States**:
  - **CLOSED**: Normal operation. Failures are counted within a rolling failure window.
  - **OPEN**: Triggered when failures exceed threshold. Immediate fail-fast without hitting external APIs, preventing request hangs.
  - **HALF_OPEN**: After a cooldown period (e.g., 30s), a single probe request is permitted to test provider recovery. Success closes the circuit; failure immediately returns it to OPEN.
- **Error Classification**: Distinguishes transient failures (timeouts, 5xx, network drops) from permanent failures (invalid recipient, template error, authentication failure). Transient errors trigger outbox retries; permanent errors terminate immediately without wasteful retries.

The outbox worker currently supports both `EMAIL` and `IN_APP` channels, but no business workflow currently schedules an `EMAIL` outbox job. Registration, verification resend, and password recovery send synchronously through `MailAdapter`; the outbox's email retry policy is therefore not part of those auth flows.

---

## 6. Observability, Security & Production Safety

- **Zero Secret Leakage**: Passwords, tokens, database connection strings, and API keys are never logged. Verified via `npm run security:check`.
- **Strict Headers**: Helmet, CORS origin allowlists matching exact HTTPS frontend origins, 64 KB JSON limits, and HttpOnly cookies.
- **Health Checks**:
  - `/api/health`: Public readiness probe verifying database connectivity.
  - `/api/admin/health`: Authenticated staff probe reporting configuration status across services.
