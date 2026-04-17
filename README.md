# TicketBot — Telegram Ticket Management System

A monorepo for a Telegram-based ticket management system with a web dashboard, REST API, and AI-powered meeting note extraction.

## Quick Start

```bash
# Prerequisites: Node 20+, pnpm 10+, Docker

# Start infrastructure
docker compose up -d

# Install dependencies
pnpm install

# Generate Prisma client and run migrations
pnpm db:generate
pnpm db:migrate

# Seed the database
pnpm db:seed

# Start all apps in development mode
pnpm dev
```

## Project Structure

```
apps/
  api/          NestJS API (Fastify) — port 3000
  bot/          Telegraf bot (webhook, runs inside API)
  web/          Next.js 15 dashboard — port 3001

libs/
  database/         Prisma schema, client, migrations
  shared-types/     Domain TypeScript interfaces
  shared-validation/ Zod schemas shared across apps
  core/             Shared business logic and utilities
  ai/               AI provider abstraction (OpenAI)
```

## Common Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all apps in development mode |
| `pnpm build` | Build all packages |
| `pnpm test` | Run all tests |
| `pnpm lint` | Lint all packages |
| `pnpm db:migrate` | Run Prisma migrations |
| `pnpm db:seed` | Seed the database |
| `pnpm db:studio` | Open Prisma Studio |

See `docs/ADR-001-foundations.md` for architecture decisions.
