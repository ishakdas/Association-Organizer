# Development Guide

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 20+ | Runtime |
| pnpm | 10+ | Package manager |
| Docker & Docker Compose | Latest | PostgreSQL + Redis |
| Git | Latest | Version control |

## First-Time Setup

### 1. Clone and Install

```bash
git clone https://github.com/ishakdas/Association-Organizer.git
cd Association-Organizer
pnpm install
```

### 2. Start Infrastructure

```bash
docker compose up -d
```

This starts:
- **PostgreSQL 16** on `localhost:5432` (user: `ticketbot`, password: `ticketbot`, db: `ticketbot`)
- **Redis 7** on `localhost:6379`

Verify they're running:
```bash
docker compose ps
```

### 3. Configure Environment

```bash
# Database
cp libs/database/.env.example libs/database/.env

# API
cp apps/api/.env.example apps/api/.env

# Web
cp apps/web/.env.example apps/web/.env
```

**For local development**, the default values in `.env.example` files work with the Docker containers. You only need to configure:
- `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_JWT_SECRET` — from your Supabase project dashboard
- `BOT_TOKEN` — from [@BotFather](https://t.me/BotFather) on Telegram
- `JWT_SECRET` — any random 32+ character string (e.g., `openssl rand -base64 32`)
- `OPENAI_API_KEY` — from OpenAI (only needed for AI extraction features)

### 4. Database Setup

```bash
# Generate Prisma client (creates TypeScript types from schema)
pnpm db:generate

# Run migrations (creates all tables in PostgreSQL)
pnpm db:migrate

# Seed with sample data
pnpm db:seed
```

### 5. Start Development

```bash
# Start all apps
pnpm dev

# Or start individually:
pnpm dev:api   # NestJS API on port 3000
pnpm dev:web   # Next.js on port 3001
```

## Development Workflow

### Running Commands

All commands are run from the **workspace root**, not from individual packages.

```bash
# Build everything
pnpm build

# Run all tests
pnpm test

# Lint everything
pnpm lint

# Target a specific package
pnpm --filter api test
pnpm --filter @ticketbot/database prisma studio
pnpm --filter web build
```

### Making Database Changes

1. Edit `libs/database/prisma/schema.prisma`
2. Run `pnpm db:migrate` — this creates a migration file and applies it
3. Run `pnpm db:generate` — regenerates the Prisma client types
4. The new types are immediately available across all packages via `@ticketbot/database`

### Adding a New API Endpoint

1. Create or update a module in `apps/api/src/modules/<module>/`
2. Add the Zod validation schema in `libs/shared-validation/src/schemas/`
3. Add the DTO type in `libs/shared-types/src/domain/`
4. Export from the respective `index.ts` barrel files
5. Import the schema in your controller and use `ZodValidationPipe`

Example:
```typescript
@Post()
create(
  @Body(new ZodValidationPipe(createTicketSchema)) body: CreateTicketInput,
  @CurrentOrg() organisationId: string,
  @CurrentUser() user: RequestUser,
) {
  return this.ticketsService.create(body, organisationId, user.id);
}
```

### Adding a New Bot Command

1. Create a file in `apps/bot/src/commands/<command>.command.ts`
2. Export a `registerXCommand(bot, ...deps)` function
3. Register it in `apps/bot/src/bot.service.ts` inside `onModuleInit()`

### Adding a New Web Page

1. Create a page file in `apps/web/src/app/(protected)/<path>/page.tsx`
2. Protected pages go in the `(protected)` route group (auth is enforced by the layout)
3. Public pages go in `(auth)` or at the root `app/` level
4. Use `createServerClient()` from `lib/supabase/server.ts` to get the session in server components

### Nx Caching

Nx caches build outputs locally. To clear the cache:
```bash
npx nx reset
```

Build targets that should NOT be cached (like `prisma generate`) have `"cache": false` in their `project.json`.

## Project Layout

```
/
├── apps/
│   ├── api/                      # NestJS REST API (Fastify)
│   │   ├── src/
│   │   │   ├── main.ts           # Fastify bootstrap + webhook mount
│   │   │   ├── app.module.ts     # Root NestJS module
│   │   │   ├── config/           # Env validation, ConfigModule factory
│   │   │   ├── common/           # Guards, filters, pipes, decorators
│   │   │   │   ├── guards/       # AuthGuard, TenantGuard, RolesGuard
│   │   │   │   ├── filters/      # RFC 7807 HttpExceptionFilter
│   │   │   │   ├── pipes/        # ZodValidationPipe
│   │   │   │   └── decorators/   # @CurrentUser, @CurrentOrg, @Roles
│   │   │   └── modules/          # Feature modules
│   │   │       ├── auth/         # Token generation + redemption
│   │   │       ├── tickets/      # Full CRUD (implemented)
│   │   │       ├── comments/     # Stubbed
│   │   │       ├── organisations/# Stubbed
│   │   │       ├── users/        # Stubbed
│   │   │       ├── meeting-notes/# Stubbed
│   │   │       ├── extensions/   # Stubbed
│   │   │       ├── notifications/# Stubbed
│   │   │       └── jobs/         # Stubbed (BullMQ)
│   │   ├── .env.example
│   │   └── jest.config.ts
│   │
│   ├── bot/                      # Telegraf bot (runs inside API)
│   │   ├── src/
│   │   │   ├── index.ts          # Barrel exports (BotModule, BotService)
│   │   │   ├── bot.service.ts    # Telegraf instance, command registration
│   │   │   ├── bot.module.ts     # NestJS module
│   │   │   ├── commands/         # /start, /link, /help
│   │   │   ├── handlers/         # Inline keyboard callback handlers
│   │   │   ├── keyboards/        # Inline keyboard builders
│   │   │   └── utils/            # MarkdownV2 formatter
│   │   └── .env.example
│   │
│   └── web/                      # Next.js 15 App Router
│       ├── src/
│       │   ├── app/
│       │   │   ├── layout.tsx    # Root layout
│       │   │   ├── page.tsx      # Redirects to /tickets
│       │   │   ├── (auth)/       # Login, callback (public)
│       │   │   └── (protected)/  # Tickets, notes, settings (auth required)
│       │   ├── lib/
│       │   │   ├── supabase/     # Browser + server Supabase clients
│       │   │   └── api/          # API client + ticket fetchers
│       │   ├── components/       # React components
│       │   └── middleware.ts     # Auth redirect middleware
│       ├── next.config.ts
│       └── .env.example
│
├── libs/
│   ├── database/                 # Prisma ORM layer
│   │   ├── prisma/
│   │   │   ├── schema.prisma     # 14 models, 3 enums, all indexes
│   │   │   └── seed.ts           # Sample data (1 org, 4 users, 3 tickets)
│   │   └── src/
│   │       ├── index.ts          # Barrel (PrismaClient, PrismaService, PrismaModule)
│   │       ├── prisma-client.ts  # Singleton with global caching
│   │       ├── prisma.service.ts # NestJS injectable
│   │       └── prisma.module.ts  # Global NestJS module
│   │
│   ├── shared-types/             # Domain interfaces (no runtime deps)
│   │   └── src/
│   │       ├── enums.ts          # Role, TicketStatus, TicketPriority
│   │       └── domain/           # DTOs: ticket, user, org, auth, etc.
│   │
│   ├── shared-validation/        # Zod schemas (runtime validation)
│   │   └── src/schemas/          # ticket, comment, auth, extension, etc.
│   │
│   ├── core/                     # Shared utilities (currently empty)
│   │
│   └── ai/                       # AI provider abstraction
│       └── src/
│           ├── ai-provider.interface.ts  # AiProvider contract
│           ├── providers/        # OpenAiProvider, FakeAiProvider
│           ├── prompts/          # Prompt templates
│           ├── ai.service.ts     # NestJS injectable
│           └── ai.module.ts      # NestJS module
│
├── docs/                         # Documentation
├── docker-compose.yml            # PostgreSQL + Redis
├── nx.json                       # Nx workspace config
├── pnpm-workspace.yaml           # Workspace packages
└── tsconfig.base.json            # Shared TypeScript config
```

## Debugging

### API not starting?
- Check `DATABASE_URL` is correct and PostgreSQL is running: `docker compose ps`
- Check all required env vars are set: the API validates on startup and prints missing vars
- Check port 3000 isn't in use: `lsof -i :3000`

### Prisma errors?
- Run `pnpm db:generate` after any schema change
- Run `pnpm db:migrate` to apply pending migrations
- If migrations are out of sync: `pnpm --filter @ticketbot/database prisma migrate reset` (destroys data)

### Bot not receiving messages?
- In local dev, the webhook can't be set (no public URL). Use [ngrok](https://ngrok.com/) to expose port 3000
- Or override to polling mode for local testing (not implemented in v1)
- Check `BOT_TOKEN` is correct

### TypeScript path aliases not resolving?
- Ensure you're importing from `@ticketbot/<package>` not relative paths
- The `tsconfig.base.json` paths map to source files (not compiled output)
- For apps, `tsconfig.json` uses `noEmit: true` (type-check only); `tsconfig.build.json` compiles

### Next.js build fails on workspace imports?
- Check `transpilePackages` in `apps/web/next.config.ts` includes the workspace package
- Ensure the lib's `tsconfig.json` doesn't set `rootDir` (it conflicts with path aliases)

## What's Next

This is a v1 foundation. There are **62 tracked GitHub issues** covering everything from stubbed modules to production hardening, security, GDPR, and operational readiness.

See [docs/ROADMAP.md](ROADMAP.md) for the full phased implementation plan:
- **Phase 1** (17 issues): Core features — system is non-functional without these
- **Phase 2** (10 issues): Security & infrastructure — required before production
- **Phase 3** (7 issues): UX & operations — usable and maintainable
- **Phase 4** (14 issues): Hardening — edge cases, testing, code quality
- **Phase 5** (14 issues): Nice to have — polish and future-proofing

Browse all issues: [github.com/ishakdas/Association-Organizer/issues](https://github.com/ishakdas/Association-Organizer/issues)
