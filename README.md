# TicketBot — Telegram Ticket Management System

A monorepo for a Telegram-based ticket management system with a web dashboard, REST API, and AI-powered meeting note extraction.

## Quick Start

```bash
# Prerequisites: Node 20+, pnpm 10+, Docker

# Start infrastructure
docker compose up -d

# Install dependencies
pnpm install

# Copy environment files
cp libs/database/.env.example libs/database/.env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

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
  bot/          Telegraf bot (webhook, runs inside API process)
  web/          Next.js 15 dashboard — port 3001

libs/
  database/          Prisma schema, client, migrations, seed
  shared-types/      Domain TypeScript interfaces and enums
  shared-validation/ Zod schemas shared across apps
  core/              Shared business logic and utilities
  ai/                AI provider abstraction (OpenAI)

docs/
  ADR-001-foundations.md   Architecture decision record
```

## Common Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all apps in development mode |
| `pnpm build` | Build all packages |
| `pnpm test` | Run all tests |
| `pnpm lint` | Lint all packages |
| `pnpm db:generate` | Generate Prisma client |
| `pnpm db:migrate` | Run Prisma migrations |
| `pnpm db:seed` | Seed the database |
| `pnpm db:studio` | Open Prisma Studio |

## What's Implemented vs Stubbed

| Feature | Status | Notes |
|---------|--------|-------|
| **Prisma schema** | Implemented | 14 models, 3 enums, all indexes, soft delete |
| **Seed data** | Implemented | 1 org, 4 users, 3 tickets, comments, audit logs |
| **Shared types** | Implemented | All domain DTOs and enums |
| **Shared validation** | Implemented | Zod schemas for all CRUD operations |
| **API bootstrap** | Implemented | NestJS + Fastify, CORS, global prefix, RFC 7807 errors |
| **Auth (API)** | Implemented | Supabase JWT + HS256 bot tokens via `jose` |
| **Tenant guard** | Implemented | `x-organisation-id` header, membership verification |
| **Roles guard** | Implemented | Hierarchical: MEMBER < MANAGER < ADMIN < SUPER_ADMIN |
| **Tickets CRUD** | Implemented | POST/GET/GET:id/PATCH/DELETE, soft delete, status history |
| **Telegram link tokens** | Implemented | Generate + redeem via API |
| **Bot /start** | Implemented | Welcome message with linking instructions |
| **Bot /link** | Implemented | Token redemption, TelegramAccount creation |
| **Bot reminder handler** | Implemented | Inline keyboard: Done / Request Extension / Dismiss |
| **Web login** | Implemented | Supabase Auth, email + password |
| **Web /tickets** | Implemented | Server component, fetches from API |
| **Web auth middleware** | Implemented | Redirects unauthenticated users |
| **AI provider interface** | Implemented | `AiProvider` with `generateStructured<T>()` |
| **OpenAI provider** | Implemented | Structured outputs, Zod validation, 1-retry fallback |
| **AI test** | Implemented | FakeAiProvider, 3 passing tests |
| **Comments module** | Stubbed | TODO: CRUD endpoints |
| **Organisations module** | Stubbed | TODO: CRUD + member management |
| **Users module** | Stubbed | TODO: profile endpoints |
| **Meeting notes module** | Stubbed | TODO: CRUD + AI extraction trigger |
| **Extensions module** | Stubbed | TODO: request/approve/reject |
| **Notifications module** | Stubbed | TODO: Telegram/email/web push |
| **Jobs (BullMQ)** | Stubbed | TODO: reminder + extension SLA queues |
| **Web ticket detail** | Stubbed | TODO: detail view, comments, status change |
| **Web create ticket** | Stubbed | TODO: form with Zod validation |
| **Web meeting notes** | Stubbed | TODO: list + AI extraction UI |
| **Web telegram settings** | Stubbed | TODO: link/unlink Telegram |
| **Web organisation** | Stubbed | TODO: members, roles |

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](docs/ARCHITECTURE.md) | System diagrams, data flows, design decisions, security model |
| [Development Guide](docs/DEVELOPMENT.md) | Setup, workflow, debugging, project layout |
| [Deployment Guide](docs/DEPLOYMENT.md) | Railway, Vercel, Supabase setup, production checklist |
| [API Reference](docs/API-REFERENCE.md) | All endpoints, request/response formats, auth details |
| [Database Schema](docs/DATABASE.md) | ER diagram, all 14 models, enums, indexes, seed data |
| [Testing Guide](docs/TESTING.md) | Test strategy, running tests, writing new tests |
| [ADR-001](docs/ADR-001-foundations.md) | Architecture decision record — all locked + unspecified decisions |

## Architecture

Key points:
- **Monorepo**: pnpm workspaces + Nx (package-based mode)
- **Bot runs inside the API** process via webhook at `/telegram/webhook`
- **Auth dual-mode**: Supabase JWT for web, HS256 for bot sessions
- **Multi-tenancy**: Row-level via `organisationId`, enforced by `TenantGuard`
- **AI**: Swappable provider interface, OpenAI structured outputs with Zod validation
- **Deploy target**: Railway (API + Redis), Vercel (Web), Supabase (Postgres)

See [Architecture](docs/ARCHITECTURE.md) for full system diagrams and data flow examples.
