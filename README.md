# Association Organizer

Association Organizer is a monorepo for managing associations in Turkey. It combines a NestJS API, a Next.js dashboard, and a Telegram bot that runs inside the API process. Shared libraries cover database access, domain types, validation schemas, and AI integrations.

## Quick Start

```bash
# Prerequisites: Node 20+, pnpm 10+, Docker

# Start local Postgres
docker compose up -d

# Install dependencies
pnpm install

# Create the root environment file and fill its values
touch .env

# Generate Prisma client, run migrations, and seed
pnpm db:generate
pnpm db:migrate
pnpm db:seed

# Start all apps in development mode
pnpm dev
```

## Workspace

```
apps/
  api/   NestJS 11 API with Fastify - port 3000
  bot/   Telegraf bot, served through the API webhook at /telegram/webhook
  web/   Next.js 15 dashboard - port 3001

libs/
  database/            Prisma schema, client, migrations, seed, module
  shared-types/        Domain TypeScript interfaces and enums
  shared-validation/   Zod schemas shared across apps
  ai/                  AI provider abstraction and prompt helpers

docs/
  01-project-overview.md
  02-architecture.md
  05-api-modules.md
  06-frontend-architecture.md
  08-shared-libraries.md
  09-development-workflow.md
  10-deployment-infrastructure.md
```

## Common Commands

| Command                  | Description                                |
| ------------------------ | ------------------------------------------ |
| `pnpm dev`               | Start all apps in parallel                 |
| `pnpm dev:api`           | Start the API only                         |
| `pnpm dev:web`           | Start the web app only                     |
| `pnpm dev:bot`           | Start the bot only, inside the API process |
| `pnpm build`             | Build all packages via Nx                  |
| `pnpm lint`              | Lint all packages via Nx                   |
| `pnpm test`              | Run all tests via Nx                       |
| `pnpm db:generate`       | Generate the Prisma client                 |
| `pnpm db:migrate`        | Run Prisma migrations in dev               |
| `pnpm db:migrate:deploy` | Run Prisma migrations for production       |
| `pnpm db:seed`           | Seed the database                          |
| `pnpm db:studio`         | Open Prisma Studio                         |
| `pnpm db:dev-reset`      | Drop and recreate the dev database         |

## Current Shape

- The API is organized around feature modules such as auth, associations, users, tasks, meetings, events, finance, permissions, admin, Islamic calendar, email, and AI helper.
- The bot is not a separate server; it is mounted on the API webhook at `/telegram/webhook`.
- The web app uses Supabase Auth and serves the authenticated dashboard on port 3001 in development.
- Shared packages are imported through the `@ticketbot/*` path aliases.

## Docs

- [Environment Management](docs/ENVIRONMENTS.md)
- [Project Overview](docs/01-project-overview.md)
- [Architecture](docs/02-architecture.md)
- [API Modules](docs/05-api-modules.md)
- [Frontend Architecture](docs/06-frontend-architecture.md)
- [Shared Libraries](docs/08-shared-libraries.md)
- [Development Workflow](docs/09-development-workflow.md)
- [Deployment Infrastructure](docs/10-deployment-infrastructure.md)
- [ADR-001](docs/ADR-001-foundations.md)

## Architecture Notes

- Monorepo management uses pnpm workspaces with Nx in package-based mode.
- Authentication is dual-mode: Supabase JWT for web users and HS256 bot tokens for Telegram flows.
- Multi-tenancy is enforced at the association level, with soft delete required for tenant-scoped queries.
- AI uses a swappable provider abstraction with structured output validation.
