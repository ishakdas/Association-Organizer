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
nx run api:test -- --testPathPattern=associations.service.spec

# API e2e
pnpm --filter api test:e2e

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
- `@ticketbot/database` — `PrismaService`, `PrismaModule`, Prisma enums re-exported
- `@ticketbot/shared-types` — Plain TS interfaces (`AuthenticatedUser`, `AuthMembership`, domain DTOs) and enums. Enums are duplicated here from Prisma so the web/validation packages don't depend on Prisma.
- `@ticketbot/shared-validation` — Zod schemas used for both API validation and frontend forms. Adding a new entity means adding a schema here first.
- `@ticketbot/core` — Shared business logic / utilities
- `@ticketbot/ai` — `AiProvider` interface, OpenAI and Fake implementations, prompt definitions

**API modules** (under `apps/api/src/modules/`)
- `auth` — token issuance, Telegram link tokens, `GET /auth/me`
- `users` — user provisioning (Supabase + DB-only paths)
- `associations` — association CRUD, membership management, member-title assignment
- `tasks` — per-association task board
- `meetings` — meeting notes with attendees
- `titles` — system-admin-managed `MemberTitleDefinition` catalog
- `supabase` — admin Supabase client (service-role) used for provisioning
- `jobs` — BullMQ queues (stubbed)

## Domain model

Prisma schema lives in `libs/database/prisma/schema.prisma`. The core entities:

| Model | Purpose |
|---|---|
| `User` | Global identity. `supabaseUserId` (unique, nullable) links to Supabase `auth.users`. DB-only members have `supabaseUserId: null`. |
| `Association` | A dernek. Tenant root; every tenant-scoped row carries `associationId`. |
| `AssociationMembership` | Join row granting a `UserRole` inside an association. May reference a `MemberTitleDefinition` (titleId) or a freeform `customTitle`. |
| `MemberTitleDefinition` | System-admin-managed catalog of assignable titles (e.g. Başkan Yardımcısı, Sayman). |
| `Task` | Per-association task assigned to a member. |
| `MeetingNote` | Per-association meeting record with attendees. |
| `TelegramAccount` / `TelegramLinkToken` | Telegram ↔ User binding for the bot. |

**Key invariants**
- Multi-tenancy is row-level via `associationId`. All queries on tenant-scoped models MUST filter by `associationId` AND `deletedAt: null`.
- "One active başkan per association" is enforced by the partial unique index `one_active_manager_per_association` on `AssociationMembership`.
- Active memberships are eager-loaded onto `request.user` by `AuthGuard` so guards can authorize without an extra DB hit.

## Auth & Authorization

### Token layer — `AuthGuard`

`apps/api/src/common/guards/auth.guard.ts` handles two token types by inspecting the JWT `alg` header:

- **Supabase JWT** (`HS256`, signed with `SUPABASE_JWT_SECRET`) — issued by Supabase for web users
- **Bot token** (`HS256`, signed with `JWT_SECRET`) — issued by `AuthService.issueBotToken()` after Telegram link redemption

Both resolve to a `User` row (via `User.supabaseUserId` or the embedded `userId` claim) and attach an `AuthenticatedUser` to `request.user` — containing `{ id, email, systemRole, memberships: AuthMembership[] }`.

### Authorization layer — two guards

The project uses **two separate role guards**, chosen by the kind of endpoint:

| Guard | When to use | How it reads role |
|---|---|---|
| `RolesGuard` | System-scoped endpoints that don't live under an association context (e.g. `POST /associations`, title catalog management). | Reads `@Roles(...)` metadata. Passes if user is `SYSTEM_ADMIN` OR has any active membership with one of the required roles. |
| `AssociationRolesGuard` | Endpoints scoped to a specific association (routes with `:associationId` or `:id`). | Reads `@AssociationRoles(...)` metadata. Passes if user is `SYSTEM_ADMIN` OR has an active membership **in that specific association** with one of the required roles. |

**Important**: both guards return `true` when no `@Roles`/`@AssociationRoles` metadata is present. A handler without a role decorator on a controller using one of these guards is effectively open to any authenticated user — always decorate every handler you want restricted.

### Guard chain per endpoint kind

```
System-scoped       : AuthGuard → SupabaseUserGuard → RolesGuard              + @Roles(...)
Association-scoped  : AuthGuard → SupabaseUserGuard → AssociationRolesGuard   + @AssociationRoles(...)
```

`SupabaseUserGuard` ensures a Supabase-authenticated user has a matching row in the `User` table (rejects bot-token requests on web-only endpoints).

### Yetki matrisi (role capabilities)

`SYSTEM_ADMIN` bypasses both role guards — they can do everything below.

| Action | MANAGER (Başkan) | SECRETARY (Sekreter) | MEMBER (Üye) |
|---|---|---|---|
| Create association | ✗ (SYSTEM_ADMIN only) | ✗ | ✗ |
| List / read associations | own only | own only | own only |
| Manage members (add/update/remove) of own dernek | ✓ | ✓ | ✗ |
| Create task in own dernek | ✓ | ✓ | ✗ |
| List tasks of own dernek | ✓ | ✓ | ✓ |
| Update status of own task | ✓ (own) | ✓ (own) | ✓ (own) |
| Create meeting note | ✓ | ✓ | ✗ |
| List / read meeting notes of own dernek | ✓ | ✓ | ✓ |
| Manage `MemberTitleDefinition` catalog | ✗ | ✗ | ✗ |

### Decorators

- `@CurrentUser()` → `RequestUser` (subset of `AuthenticatedUser`)
- `@CurrentOrg()` → `string` (associationId)
- `@Roles(...UserRole[])` — metadata for `RolesGuard`
- `@AssociationRoles(...UserRole[])` — metadata for `AssociationRolesGuard`

### Telegram link-token flow

`AuthService.generateLinkToken()` creates a short-lived opaque hex token stored in `TelegramLinkToken`. The bot redeems it via `AuthService.redeemLinkToken()`, which creates a `TelegramAccount` row and issues a 30-day bot JWT.

## API Conventions

**Validation**: `ZodValidationPipe` is applied per-controller via `@UsePipes(ZodValidationPipe)` — it picks up the Zod schema from the DTO class (via `createZodDto`). The project does NOT use `class-validator`.

**Error format**: RFC 7807 Problem Details, enforced by the global `HttpExceptionFilter`. Shape: `{ type, title, status, detail, instance, errors? }`.

**New association-scoped module pattern** (use `tasks` as the reference — `apps/api/src/modules/tasks/`):
1. `X.module.ts` — imports `PrismaModule`, provides controller + service
2. `X.controller.ts` — `@Controller('associations/:associationId/x')`, class-level `@UseGuards(AuthGuard, SupabaseUserGuard, AssociationRolesGuard)` and `@UsePipes(ZodValidationPipe)`, **every** handler decorated with `@AssociationRoles(...)`
3. `X.service.ts` — all queries filtered by `associationId` AND `deletedAt: null`
4. Add Zod schemas to `libs/shared-validation/src/schemas/`
5. Add TS DTOs to `libs/shared-types/src/domain/`
6. Register module in `AppModule`

For system-scoped endpoints (no association context) use `associations` create/list as the reference — swap `AssociationRolesGuard`/`@AssociationRoles` for `RolesGuard`/`@Roles`.

## Frontend

**Supabase client setup** (`@supabase/ssr`):
- `apps/web/src/lib/supabase/server.ts` — `createServerClient()` for Server Components and Route Handlers
- `apps/web/src/lib/supabase/client.ts` — `createClient()` for Client Components
- `apps/web/src/middleware.ts` — refreshes session on every request, redirects unauthenticated users to `/login`

**API calls** go through `apps/web/src/lib/api/client.ts` (`apiClient`). It auto-attaches `Authorization: Bearer <token>`. Feature-specific wrappers live alongside it (e.g., `associations.ts`, `tasks.ts`).

**Route groups** (under `apps/web/src/app/`):
- `(auth)/` — login, OAuth callback
- `(protected)/` — all authenticated pages; the layout double-checks auth server-side and loads the `AuthenticatedUser` shape that mirrors the API's `/auth/me`

**Role-based UI** is centralized in **`apps/web/src/lib/permissions.ts`** — do not reimplement role checks inline. Use:
- `isSystemAdmin(user)`
- `hasAnyMembership(user)`
- `hasRoleInAssociation(user, associationId, ['ASSOCIATION_MANAGER'])`
- `canAccessRoute(user, 'member' | 'auth' | 'system_admin')`
- `filterNav(items, user)`
- `userRoleLabel(user)` → Turkish surface label (`Başkan`, `Sekreter`, `Üye`, `Sistem Yöneticisi`)

Server Components fetch from the NestJS API directly using the Supabase access token. UI uses the ui-ux-pro-max shell with Tailwind tokens; no TanStack Query or react-hook-form is wired up yet.

## Database

Prisma schema is in `libs/database/prisma/`. Key design decisions:
- `User.supabaseUserId` (unique, nullable string) links to Supabase `auth.users.id` — not a Prisma foreign key, just a stored UUID. DB-only members have `supabaseUserId: null`.
- Multi-tenancy is row-level via `associationId` on every tenant-scoped model. `AssociationMembership` is the join table that grants role-scoped access (`SYSTEM_ADMIN`, `ASSOCIATION_MANAGER`, `ASSOCIATION_SECRETARY`, `ASSOCIATION_MEMBER`).
- The "one active başkan per association" invariant is enforced by a partial unique index (`one_active_manager_per_association`) — see `libs/database/prisma/migrations/20260424080804_add_one_active_manager_partial_index/`.
- Soft-delete via `deletedAt` on `Association`, `AssociationMembership`, `Task`, `MeetingNote`. **All queries MUST include `deletedAt: null`.**

### Provisioning sagas (Supabase ↔ DB)

Creating a user with a Supabase identity is a two-step saga (Supabase auth user + Prisma `User`/`AssociationMembership` rows). The canonical pattern is in `apps/api/src/modules/users/users.service.ts`: create Supabase user → `try { prisma.$transaction(...) } catch { supabaseAdmin.deleteUser(id) }`. Any new provisioning flow MUST use the same rollback discipline — silently swallowing the rollback catch leaves orphaned Supabase users.

### Stubbed-but-present fields (do NOT test or wire yet)

- `Task.notifiedViaTelegram / notifiedViaWhatsapp / notifiedViaEmail / lastNotifiedAt / reminderAt / reminderFrequency` — reserved for the upcoming **notification system**. Columns exist and `taskResponseSchema` reads them, but no writer/scheduler exists. Don't add tests around notification side-effects.
- `MeetingNote.derivedTasks` (Task[] back-relation via `Task.sourceMeetingNoteId`) — reserved for **meeting-to-task extraction** (spawn action items from a meeting note). Not implemented.

## Known pending / intentionally deferred

- **Task notification scheduler** — BullMQ reminder jobs driving the `notified*` / `lastNotifiedAt` columns on `Task`. `JobsModule` is currently stubbed.
- **Meeting-to-task extraction** — turning a `MeetingNote` into a set of `Task` rows via `sourceMeetingNoteId`. AI plumbing (`@ticketbot/ai`) exists; the extraction flow does not.
- **apps/web test harness** — no Jest/Vitest/RTL config, no `pnpm --filter web test` target. Component tests are not yet measured.
- **Playwright E2E** — not installed. Critical-flow browser tests (login → create association → add member → assign task) are not in place.

## Environment Variables

Required by the API (`apps/api/.env`): `DATABASE_URL`, `REDIS_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `JWT_SECRET`, `BOT_TOKEN`, `API_URL`, `WEB_URL`. Validated by Zod on boot (`config/env.validation.ts`) — invalid env exits the process.

Required by the web (`apps/web/.env.local`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_URL`.

`SUPABASE_SERVICE_ROLE_KEY` is backend-only — it must never appear in `apps/web/` code or in any `NEXT_PUBLIC_*` variable.

## Infrastructure

- **Deploy**: API + Redis → Railway; Web → Vercel; DB → Supabase (PostgreSQL)
- **BullMQ**: `JobsModule` is stubbed; will drive task reminders and meeting-to-task extraction.
- **Docker Compose**: Provides local Postgres + Redis for development.
