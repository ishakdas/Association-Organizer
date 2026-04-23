# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Dev (all apps in parallel)
pnpm dev

# Individual apps
pnpm dev:api        # NestJS API on :3000
pnpm dev:bot        # Bot (runs inside API process)
pnpm dev:web        # Next.js on :3001

# Build / lint / test (all workspaces via Nx)
pnpm build
pnpm lint
pnpm test

# Single app
nx run api:test
nx run web:test

# Single spec file
nx run api:test -- --testPathPattern=tickets.controller.spec

# Database
pnpm db:generate    # prisma generate
pnpm db:migrate     # prisma migrate dev
pnpm db:seed        # seed data
pnpm db:studio      # Prisma Studio UI
```

## Architecture

**Monorepo**: pnpm workspaces + Nx (package-based mode). Two workspace roots: `apps/*` and `libs/*`.

**Apps**
- `apps/api` — NestJS 11 on Fastify, global prefix `api/v1`, port 3000
- `apps/bot` — Telegraf bot exported as a lib; runs inside the API process, not as a separate server. Webhook is mounted at `/telegram/webhook` (outside the `api/v1` prefix).
- `apps/web` — Next.js 15 App Router, port 3001. Uses `transpilePackages` for `@ticketbot/shared-types` and `@ticketbot/shared-validation`.

**Libs** (all referenced via `@ticketbot/*` path aliases in `tsconfig.base.json`)
- `@ticketbot/database` — PrismaService, PrismaModule, Prisma enums re-exported
- `@ticketbot/shared-types` — Plain TS interfaces (`TicketDto`, etc.) and enums. Enums are duplicated here from Prisma so the web/validation packages don't depend on Prisma.
- `@ticketbot/shared-validation` — Zod schemas used for both API validation and frontend forms. Adding a new entity means adding a schema here first.
- `@ticketbot/core` — Shared business logic / utilities
- `@ticketbot/ai` — `AiProvider` interface, OpenAI and Fake implementations, prompt definitions

## Auth

The API has a **single `AuthGuard`** (`apps/api/src/common/guards/auth.guard.ts`) that handles two token types by inspecting the JWT `alg` header:

- **Supabase JWT** (`HS256`, signed with `SUPABASE_JWT_SECRET`) — issued by Supabase for web users
- **Bot token** (`HS256`, signed with `JWT_SECRET`) — issued by `AuthService.issueBotToken()` after Telegram link redemption

Both resolve to a `User` row via `User.supabaseId` and attach `{ id, email, supabaseId }` to `request.user`.

**Guard chain on protected controllers:**
```
AuthGuard → TenantGuard → RolesGuard
```

- `TenantGuard` reads the `x-organisation-id` header (or `:organisationId` route param), verifies the user has a `Membership` row, and attaches `request.organisationId` + `request.membership`.
- `RolesGuard` reads `@Roles()` decorator metadata and checks against membership role hierarchy: `MEMBER < MANAGER < ADMIN < SUPER_ADMIN`.

**Decorators**: `@CurrentUser()` → `RequestUser`, `@CurrentOrg()` → `string` (organisationId).

**Telegram link-token flow**: `AuthService.generateLinkToken()` creates a short-lived opaque hex token stored in `TelegramLinkToken`. Bot redeems via `AuthService.redeemLinkToken()`, which creates `TelegramAccount` and issues a 30-day bot JWT.

## API Conventions

**Validation**: `ZodValidationPipe` is applied per-param, not globally. Import the schema from `@ticketbot/shared-validation` and pass it: `@Body(new ZodValidationPipe(mySchema))`. The project does NOT use `class-validator`.

**Error format**: RFC 7807 Problem Details, enforced by the global `HttpExceptionFilter`. Shape: `{ type, title, status, detail, instance, errors? }`.

**New module pattern** (follow `tickets` module as the reference):
1. `tickets.module.ts` — imports `PrismaModule`, provides controller + service
2. `tickets.controller.ts` — `@UseGuards(AuthGuard, TenantGuard, RolesGuard)` at class level
3. `tickets.service.ts` — all queries scoped by `organisationId`, soft-delete via `deletedAt`
4. Add Zod schemas to `libs/shared-validation/src/schemas/`
5. Add TS DTOs to `libs/shared-types/src/domain/`
6. Register module in `AppModule`

## Frontend

**Supabase client setup** (`@supabase/ssr`):
- `apps/web/src/lib/supabase/server.ts` — `createServerClient()` for Server Components and Route Handlers
- `apps/web/src/lib/supabase/client.ts` — `createClient()` for Client Components
- `apps/web/src/middleware.ts` — refreshes session on every request, redirects unauthenticated users to `/login`

**API calls** go through `apps/web/src/lib/api/client.ts` (`apiClient`). It auto-attaches `Authorization: Bearer <token>` and `x-organisation-id` when those options are passed. Feature-specific wrappers live alongside it (e.g., `tickets.ts`).

**Route groups** (under `apps/web/src/app/`):
- `(auth)/` — login, OAuth callback
- `(protected)/` — all authenticated pages; the layout double-checks auth server-side

Server Components fetch from the NestJS API directly using the Supabase access token. There is currently no TanStack Query, no react-hook-form, no Tailwind, and no shadcn/ui installed — the existing UI uses inline styles as placeholders.

## Database

Prisma schema is in `libs/database/prisma/`. Key design decisions:
- `User.supabaseId` (unique string) links to Supabase `auth.users.id` — not a Prisma foreign key, just a stored UUID.
- Multi-tenancy is row-level via `organisationId` on every tenant-scoped model. The `Membership` join table enforces who belongs to which org.
- Tickets use soft-delete (`deletedAt`). All queries must include `deletedAt: null`.
- Status transitions are recorded in `TicketStatusHistory` whenever `status` changes.

## Environment Variables

Required by the API (`apps/api/.env`): `DATABASE_URL`, `REDIS_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_JWT_SECRET`, `JWT_SECRET`, `BOT_TOKEN`, `API_URL`, `WEB_URL`. Validated by Zod on boot (`config/env.validation.ts`) — invalid env exits the process.

Required by the web (`apps/web/.env.local`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_URL`.

## Infrastructure

- **Deploy**: API + Redis → Railway; Web → Vercel; DB → Supabase (PostgreSQL)
- **BullMQ**: Used for async jobs (reminders, extension SLA). `JobsModule` is stubbed.
- **Docker Compose**: Provides local Postgres + Redis for development.
