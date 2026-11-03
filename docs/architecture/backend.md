# Backend Architecture

## System Overview & Architecture Principles

The MIRHAL backend is built with NestJS, Express, Prisma, and PostgreSQL. It enforces strict separation of concerns, fail-fast startup configuration, decoupled security layers, distributed multi-instance safe throttling, durable transactional outbox background processing, and resilient mail delivery with circuit breaking.

The API contracts are the single source of truth for all consumers (`apps/web` customer frontend and `apps/admin` admin dashboard).

---

## 1. Modular Structure & Boundaries

The codebase is organized into domain and infrastructure feature modules:

- `common/config/` (`AppConfigModule`): Centralized, type-safe configuration. Validates environment variables at bootstrap using Zod schemas (`env.schema.ts`). Exposes scoped config namespaces (`app`, `database`, `auth`, `mail`, `rateLimit`, `storage`). Fails startup immediately with actionable error codes if mandatory variables are missing. Business services inject `ConfigService` rather than accessing `process.env` directly.
- `auth/` (`AuthModule`): Manages authentication, session tokens (Argon2id hashing), password recovery, and email verification.
- `rate-limit/` (`RateLimitModule`): Database-independent, multi-instance rate limiting.
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

## 3. Distributed Rate Limiting (Decoupled from Database)

Rate limiting is completely decoupled from PostgreSQL/Prisma queries to protect the primary database under heavy load or brute-force attempts:

- **Storage Adapters**:
  - `RedisRateLimitStorage`: Production adapter utilizing an atomic Redis Lua script (`INCR`, `PTTL`, `PEXPIRE`, and dynamic `blockDuration`). Works seamlessly with standalone Redis, Redis clusters, or Upstash. Multi-instance and serverless safe.
  - `InMemoryRateLimitStorage`: Zero-dependency in-memory store strictly limited to local tests and local development. Throws an error on startup if instantiated in `NODE_ENV === 'production'`.
- **Client IP & Trusted Proxy Strategy**:
  - `ClientTracker` resolves client IP securely.
  - Proxy headers (`x-forwarded-for`, `x-real-ip`) are only trusted when explicit trusted proxy conditions are met (e.g., behind verified Vercel edge rewrite when `VERCEL === '1'`).
  - Untrusted clients default to direct connection IP to prevent header spoofing.
- **Tiered Endpoint Decorators**:
  - `@RateLimitLogin()`: Strict brute-force protection (5 requests per 60s, 300s block).
  - `@RateLimitRegister()`: Account creation protection (3 requests per 60s).
  - `@RateLimitForgotPassword()` & `@RateLimitResetPassword()`: Recovery rate limiting.
  - `@RateLimitUpload()`: File upload rate limiting.
  - `@RateLimitAdmin()`: Sensitive admin mutation rate limiting.
  - `@RateLimitPublic()` & `@RateLimitAuthenticated()`: General read/write limits.
- **HTTP 429 Responses**:
  - Returns stable error code `TOO_MANY_REQUESTS`, `Retry-After` header, request ID, and localized safe message.

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
  - **OPEN**: Triggered when failures exceed threshold (e.g., 5 failures in 60s). Immediate fail-fast without hitting external APIs, preventing request hangs and rate-limit penalties.
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
