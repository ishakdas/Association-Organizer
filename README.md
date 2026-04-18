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
| **Comments module** | Stubbed | CRUD endpoints ([#1](https://github.com/ishakdas/Association-Organizer/issues/1)) |
| **Organisations module** | Stubbed | CRUD + member management ([#2](https://github.com/ishakdas/Association-Organizer/issues/2)) |
| **Users module** | Stubbed | Profile endpoints ([#3](https://github.com/ishakdas/Association-Organizer/issues/3)) |
| **Meeting notes module** | Stubbed | CRUD + AI extraction ([#4](https://github.com/ishakdas/Association-Organizer/issues/4)) |
| **Extensions module** | Stubbed | Request/approve/reject ([#5](https://github.com/ishakdas/Association-Organizer/issues/5)) |
| **Notifications module** | Stubbed | Telegram/email/web push ([#6](https://github.com/ishakdas/Association-Organizer/issues/6)) |
| **Jobs (BullMQ)** | Stubbed | Reminders + extension SLA ([#7](https://github.com/ishakdas/Association-Organizer/issues/7)) |
| **Web ticket detail** | Stubbed | Detail view, comments, status ([#8](https://github.com/ishakdas/Association-Organizer/issues/8)) |
| **Web create ticket** | Stubbed | Form with Zod validation ([#9](https://github.com/ishakdas/Association-Organizer/issues/9)) |
| **Web meeting notes** | Stubbed | List + AI extraction UI ([#10](https://github.com/ishakdas/Association-Organizer/issues/10)) |
| **Web telegram settings** | Stubbed | Link/unlink Telegram ([#11](https://github.com/ishakdas/Association-Organizer/issues/11)) |
| **Web organisation** | Stubbed | Members, roles ([#12](https://github.com/ishakdas/Association-Organizer/issues/12)) |
| **User registration** | Missing | Sign-up flow ([#36](https://github.com/ishakdas/Association-Organizer/issues/36)) |
| **Password reset** | Missing | Forgot password ([#37](https://github.com/ishakdas/Association-Organizer/issues/37)) |
| **Logout** | Missing | Sign-out button ([#38](https://github.com/ishakdas/Association-Organizer/issues/38)) |
| **Org selector** | Missing | Multi-org switching ([#13](https://github.com/ishakdas/Association-Organizer/issues/13)) |
| **User auto-provisioning** | Missing | Create User on first login ([#39](https://github.com/ishakdas/Association-Organizer/issues/39)) |

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
| [Roadmap](docs/ROADMAP.md) | All 62 issues organized by implementation phase |

## Architecture

Key points:
- **Monorepo**: pnpm workspaces + Nx (package-based mode)
- **Bot runs inside the API** process via webhook at `/telegram/webhook`
- **Auth dual-mode**: Supabase JWT for web, HS256 for bot sessions
- **Multi-tenancy**: Row-level via `organisationId`, enforced by `TenantGuard`
- **AI**: Swappable provider interface, OpenAI structured outputs with Zod validation
- **Deploy target**: Railway (API + Redis), Vercel (Web), Supabase (Postgres)

See [Architecture](docs/ARCHITECTURE.md) for full system diagrams and data flow examples.
