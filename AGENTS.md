# AGENTS.md

## Dev commands

```bash
pnpm dev              # all 3 apps in parallel (api :3000, web :3001, bot inside api)
pnpm dev:api          # api only
pnpm dev:web          # web only (port 3001)
pnpm dev:bot          # bot only (runs inside api process)
pnpm build            # all packages via Nx
pnpm lint             # all packages via Nx
pnpm test             # all packages via Nx

# Single test file
nx run api:test -- --testPathPattern=associations.service.spec

# API integration tests (requires local DB)
pnpm --filter api test:integration

# API e2e
pnpm --filter api test:e2e

# Database
pnpm db:generate          # prisma generate
pnpm db:migrate           # prisma migrate dev
pnpm db:migrate:deploy    # prisma migrate deploy (production)
pnpm db:seed              # seed data
pnpm db:studio            # Prisma Studio UI
pnpm db:dev-reset         # drop + recreate dev DB
```

**Prerequisites**: Node 20 (`.nvmrc`), pnpm 10+, Docker (Postgres :5433, Redis :6380 via `docker compose up -d`).

**Lint → typecheck → test is not enforced as a pipeline.** Run all three before marking done.

## Architecture facts that are easy to miss

- **Bot runs inside the API process** (`apps/bot` is a workspace lib imported by api). Not a separate server. Webhook at `/telegram/webhook` (outside `api/v1` prefix). In local dev, BotService uses long-polling unless `API_URL` is a public address.
- **Two role guards both return `true` by default** — a controller handler with no `@Roles` or `@AssociationRoles` decorator is open to any authenticated user. Always decorate restricted handlers.
- **Soft-delete is mandatory**: all tenant-scoped queries MUST include `deletedAt: null`. Models: `Association`, `AssociationMembership`, `Task`, `MeetingNote`.
- **Auth dual-mode**: `AuthGuard` distinguishes Supabase JWT (`HS256 + SUPABASE_JWT_SECRET`) from bot token (`HS256 + JWT_SECRET`) by reading the JWT `alg` header.
- **Provisioning saga**: creating a Supabase user + DB user must be atomic with rollback on failure — see `users.service.ts`. Silently swallowing the rollback catch leaves orphaned Supabase users.
- **Supabase service role key** is backend-only — never in `apps/web/` or `NEXT_PUBLIC_*` vars.
- **Env validated on boot**: `apps/api/src/config/env.validation.ts` — invalid env causes process exit.
- **Task assignment requires Telegram**: `TasksService.create()` rejects if assignee has no `TelegramAccount` row (reminders deliver via Telegram).

## Code conventions

- **Validation**: `ZodValidationPipe` applied per-controller (not globally). Uses `createZodDto` — the schema comes from the DTO class. No `class-validator`.
- **Error format**: RFC 7807 Problem Details via `HttpExceptionFilter`. Shape: `{ type, title, status, detail, instance, errors? }`.
- **Prettier**: `{ semi: true, singleQuote: true, trailingComma: "all", printWidth: 100 }` — enforced manually, no pre-commit hook.
- **New association-scoped module pattern**: use `apps/api/src/modules/tasks/` as reference. Guard chain: `AuthGuard → SupabaseUserGuard → AssociationRolesGuard`, every handler decorated with `@AssociationRoles(...)`.
- **Decorators**: `@CurrentUser()` → `RequestUser`, `@CurrentOrg()` → `string` (associationId).
- **Path aliases**: `@ticketbot/*` mapped in `tsconfig.base.json` — never use relative `../../..` imports across workspace boundaries.

## Stubbed fields (do not wire or test)

- `Task.notifiedViaTelegram / notifiedViaWhatsapp / notifiedViaEmail / lastNotifiedAt / reminderAt / reminderFrequency` — reserved for notification system. Columns exist but no writer/scheduler.
- `MeetingNote.derivedTasks` — reserved for meeting-to-task extraction. Not implemented.
- `JobsModule` — BullMQ queues stubbed.

## Web testing

`web` has `jest --passWithNoTests` wired but no actual test files. `pnpm --filter web test` will pass trivially.

## CI

No GitHub Actions workflows. Pre-commit hooks not configured (no husky, no lint-staged).

## Reference

`CLAUDE.md` has full architecture, API conventions, role matrix, and frontend details.
