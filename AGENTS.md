# AGENTS.md

## Dev commands

```bash
pnpm dev              # all 3 apps in parallel (api :3000, web :3001, bot inside api)
pnpm dev:api          # api only
pnpm dev:web          # web only (port 3001)
pnpm build            # all packages via Nx
pnpm lint             # all packages via Nx
pnpm test             # all packages via Nx

# Single test file
nx run api:test -- --testPathPattern=associations.service.spec

# API e2e
pnpm --filter api test:e2e

# Database
pnpm db:generate    # prisma generate
pnpm db:migrate     # prisma migrate dev
pnpm db:seed        # seed data
pnpm db:studio      # Prisma Studio UI
```

**Lint → typecheck → test is not enforced as a pipeline.** Run all three before marking done.

## Architecture facts that are easy to miss

- **Bot runs inside the API process** (`apps/bot` is a workspace lib imported by api). Not a separate server. Webhook at `/telegram/webhook` (outside `api/v1` prefix).
- **Two role guards both return `true` by default** — a controller handler with no `@Roles` or `@AssociationRoles` decorator is open to any authenticated user. Always decorate restricted handlers.
- **Soft-delete is mandatory**: all tenant-scoped queries MUST include `deletedAt: null`. Models: `Association`, `AssociationMembership`, `Task`, `MeetingNote`.
- **Auth dual-mode**: `AuthGuard` distinguishes Supabase JWT (`HS256 + SUPABASE_JWT_SECRET`) from bot token (`HS256 + JWT_SECRET`) by reading the JWT `alg` header.
- **Provisioning saga**: creating a Supabase user + DB user must be atomic with rollback on failure — see `users.service.ts`. Silently swallowing the rollback catch leaves orphaned Supabase users.
- **Supabase service role key** is backend-only — never in `apps/web/` or `NEXT_PUBLIC_*` vars.

## Code conventions

- **Validation**: `ZodValidationPipe` applied per-controller (not globally). Uses `createZodDto` — the schema comes from the DTO class. No `class-validator`.
- **Error format**: RFC 7807 Problem Details via `HttpExceptionFilter`. Shape: `{ type, title, status, detail, instance, errors? }`.
- **Prettier**: `{ semi: true, singleQuote: true, trailingComma: "all", printWidth: 100 }` — enforced manually, no pre-commit hook.
- **New association-scoped module pattern**: use `apps/api/src/modules/tasks/` as reference. Guard chain: `AuthGuard → SupabaseUserGuard → AssociationRolesGuard`, every handler decorated with `@AssociationRoles(...)`.

## Web testing

`web` package has no test target wired up despite Jest being installed. Don't attempt `pnpm --filter web test`.

## CI

No GitHub Actions workflows found in `.github/workflows/`. Pre-commit hooks not configured.

## Reference

`CLAUDE.md` has full architecture and API convention details.
