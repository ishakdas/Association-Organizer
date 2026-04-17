# ADR-001: Foundation Architecture Decisions

**Status:** Accepted  
**Date:** 2026-04-17

## Context

We are building a Telegram-based ticket management system that enables organisations to manage tickets, extract action items from meeting notes via AI, and interact with the system through both a web dashboard and a Telegram bot. This ADR captures the foundational technology and architecture decisions for the v1 build.

## Locked Decisions

### Monorepo Strategy
**pnpm workspaces + Nx** in package-based mode. pnpm handles dependency resolution and workspace linking; Nx provides task orchestration, dependency-aware build ordering, and local computation caching. No Nx generators or integrated-mode conventions are used.

### Language
**TypeScript** with `strict: true` in every package. Target ES2022 for modern syntax support (top-level await, `structuredClone`, etc.).

### API
**NestJS with the Fastify adapter.** Fastify gives us structured logging (pino) out of the box and better throughput than Express. All API routes are prefixed with `/api/v1`.

### Bot
**Telegraf in webhook mode.** The bot process runs inside the API server — Telegraf's update handler is mounted as a Fastify route at `/telegram/webhook`. This avoids a separate deployment and shares database access with the API. Long-polling is not used.

### Web Dashboard
**Next.js 15 App Router.** Server components for data fetching, client components for interactivity. The web app calls the API over HTTP; it never accesses the database directly.

### Database
**PostgreSQL via Supabase, Prisma ORM.** Supabase hosts the database and provides auth infrastructure. Prisma handles schema management, migrations, and type-safe queries. The Prisma client is shared across apps via `libs/database`.

### Authentication
- **Web users:** Supabase Auth issues JWTs. The API verifies them against Supabase's JWKS endpoint using the `jose` library.
- **Bot sessions:** After Telegram account linking, the API issues HS256 JWTs containing `{ userId, telegramId, organisationId }`.
- **Telegram linking:** The web dashboard generates a short-lived one-time token. The user redeems it in the bot via `/link <token>`. On redemption, the API creates a `TelegramAccount` record and marks the token as used.

### Validation
**Zod** schemas shared between the API (server-side validation pipe) and web (form validation). Schemas live in `libs/shared-validation` and export both the schema object and the inferred TypeScript type.

### Background Jobs
**BullMQ + Redis.** Used for deadline reminders, extension SLA processing, and future async work. Redis is included in `docker-compose.yml`. The API process runs both the HTTP server and BullMQ workers.

### AI
**OpenAI via structured outputs.** Responses are validated against a Zod schema. On parse failure: one retry with the parser error fed back into the prompt, then flag for manual review. The provider is swappable via an `AiProvider` interface — an `OpenAiProvider` implementation is provided, plus a `FakeAiProvider` for testing.

### Multi-tenancy
**Row-level via `organisationId`** on every tenant-owned table. A NestJS `TenantGuard` reads the organisation from the authenticated principal and injects it into the request context. Users can belong to multiple organisations via the `Membership` table. No Postgres RLS in v1 — tenancy is enforced at the application layer.

### Deployment Target
**Railway** for API + bot + Redis, **Vercel** for the web dashboard, **Supabase** for PostgreSQL. Deployment configs are not generated in v1 but the architecture is designed with these targets in mind.

### Testing
One happy-path **integration test per app** in v1. No unit test sprawl. Tests use real infrastructure (test database via Docker, fake AI provider) rather than mocks.

## Unspecified Decisions

These three areas were not specified in the requirements. Below is the call made for each, with rationale.

### A. Ticket Status Enum

**Decision:** Six states — `OPEN`, `IN_PROGRESS`, `WAITING`, `RESOLVED`, `CLOSED`, `REOPENED`.

**Rationale:** A minimal 3-state model (open/in-progress/closed) doesn't capture the "waiting for extension approval" workflow or distinguish resolved-but-not-yet-closed tickets. Six states cover the full lifecycle without requiring a configurable state machine. The `WAITING` state is used when a deadline extension is pending. Adding new states later is a straightforward Prisma migration.

### B. Error Response Format

**Decision:** RFC 7807 Problem Details (`{ type, title, status, detail, instance?, errors? }`).

**Rationale:** This is an IETF standard for HTTP error responses. The `type` field provides a machine-readable error identifier (URI), `detail` is human-readable, and the optional `errors` array holds per-field Zod validation failures. It is well-supported by API clients and avoids inventing a custom error shape.

### C. Logging Framework

**Decision:** pino, via Fastify's built-in logger.

**Rationale:** Fastify already initialises pino internally. Using it directly avoids adding a second logging library, produces structured JSON logs by default (which Railway's log drain can parse), and has near-zero serialisation overhead. The bot module and background job processors also use pino for consistency.

## Consequences

- Changing the ticket status enum requires a Prisma migration and updating the corresponding Zod enum in `libs/shared-validation`.
- RFC 7807 errors require a custom NestJS exception filter to transform NestJS's default error shape.
- pino's JSON output is not human-friendly in development; we'll use `pino-pretty` as a dev dependency for readable local logs.
