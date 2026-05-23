# Project Overview

## Introduction

Association Organizer is a comprehensive monorepo application designed to manage associations (dernekler) in Turkey. It provides a complete solution for association management including member management, task tracking, meeting notes, event planning, financial tracking, and AI-powered suggestions, all integrated with a Telegram bot for notifications and user interaction.

## Monorepo Structure

The project uses **pnpm workspaces** combined with **Nx** (package-based mode) for monorepo management.

```
Association-Organizer/
├── apps/                    # Application packages
│   ├── api/                 # NestJS 11 API server (Fastify)
│   ├── bot/                 # Telegram bot (runs inside API process)
│   └── web/                 # Next.js 15 web application
├── libs/                    # Shared libraries
│   ├── database/            # Prisma service and database utilities
│   ├── shared-types/        # TypeScript interfaces and DTOs
│   ├── shared-validation/   # Zod validation schemas
│   ├── core/                # Shared business logic
│   └── ai/                  # AI provider interfaces and implementations
├── docs/                    # Documentation
├── scripts/                 # Utility scripts
└── design-system/           # Design system assets
```

## Tech Stack

### Backend (apps/api)
- **Framework**: NestJS 11
- **HTTP Server**: Fastify
- **Database**: PostgreSQL (via Supabase)
- **ORM**: Prisma
- **Authentication**: Supabase Auth + Custom JWT
- **Bot Framework**: Telegraf (Telegram)
- **Queue System**: BullMQ (stubbed, for future use)
- **API Prefix**: `api/v1`
- **Port**: 3000

### Frontend (apps/web)
- **Framework**: Next.js 15 (App Router)
- **Styling**: Tailwind CSS
- **Authentication**: Supabase SSR (`@supabase/ssr`)
- **Port**: 3001

### Database
- **Provider**: PostgreSQL (Supabase)
- **ORM**: Prisma
- **Migrations**: Prisma Migrate

### Infrastructure
- **API Deployment**: Railway
- **Web Deployment**: Vercel
- **Database**: Supabase (PostgreSQL)
- **Cache/Queue**: Redis

## Key Features

### 1. Association Management
- Association registration and profile management
- Member management with role-based access control
- Custom title assignments (Başkan, Sekreter, etc.)
- Multi-tenancy with row-level isolation

### 2. Task Management
- Per-association task boards
- Task assignment with Telegram notifications
- Task status tracking (PENDING, IN_PROGRESS, COMPLETED, CANCELLED)
- Priority levels (LOW, MEDIUM, HIGH)
- Task activity audit trail
- Dispute resolution for wrongly assigned tasks
- Reminder system (stubbed)

### 3. Meeting Notes
- Meeting note creation and management
- Attendee tracking
- Meeting-to-task extraction (planned)

### 4. Event Management
- Event creation with types (Conference, Talk, Seminar, Iftar, Kandil, Meeting, Custom)
- Recurring event support (Daily, Weekly, Monthly)
- Event role definitions per association
- Member assignments to event roles
- Event program/schedule items
- External event integration (municipal websites)
- Telegram notifications for assignees

### 5. Financial Tracking
- Income and expense tracking
- Transaction categories
- Event-linked transactions
- Receipt management
- Finance permissions system

### 6. AI-Powered Suggestions
- Islamic event suggestions (sohbet, education, culture, youth, family, etc.)
- Target audience filtering (all, middle school, high school)
- Feedback system for learning
- Prompt template versioning
- Saved suggestions for later use

### 7. Telegram Bot Integration
- User account linking via `/link` command
- Task notifications and updates
- Event reminders
- Settings management
- Inline keyboards for interactions

### 8. Islamic Calendar Integration
- Islamic date calculations
- Religious event tracking (Kandil, etc.)

### 9. Admin Features
- System admin user management
- Member title definition catalog
- Pending branch registration review
- AI suggestion management

## Workspace Libraries

| Library | Purpose |
|---------|---------|
| `@ticketbot/database` | PrismaService, PrismaModule, Prisma enums re-export |
| `@ticketbot/shared-types` | TypeScript interfaces, DTOs, domain enums |
| `@ticketbot/shared-validation` | Zod schemas for API validation and frontend forms |
| `@ticketbot/core` | Shared business logic and utilities |
| `@ticketbot/ai` | AiProvider interface, OpenAI and Fake implementations |

## Package Manager Configuration

- **Package Manager**: pnpm 10.29.3
- **Workspace Definition**: `pnpm-workspace.yaml`
- **Nx Configuration**: `nx.json` (package-based mode)
- **Path Aliases**: Defined in `tsconfig.base.json` (e.g., `@ticketbot/*`)

## Development Commands

```bash
# Development
pnpm dev              # All 3 apps in parallel (api :3000, web :3001, bot inside api)
pnpm dev:api          # API only
pnpm dev:web          # Web only (port 3001)
pnpm dev:bot          # Bot only (runs inside API process)

# Build / Test / Lint
pnpm build            # All packages via Nx
pnpm lint             # All packages via Nx
pnpm test             # All packages via Nx

# Database
pnpm db:generate      # Prisma generate
pnpm db:migrate       # Prisma migrate dev
pnpm db:seed          # Seed data
pnpm db:studio        # Prisma Studio UI
```

## Environment Requirements

### API (apps/api/.env)
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (backend only)
- `SUPABASE_JWT_SECRET` - Supabase JWT secret
- `JWT_SECRET` - Bot JWT secret
- `BOT_TOKEN` - Telegram bot token
- `API_URL` - API base URL
- `WEB_URL` - Web app base URL

### Web (apps/web/.env.local)
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `NEXT_PUBLIC_API_URL` - API base URL

**Important**: `SUPABASE_SERVICE_ROLE_KEY` must never appear in `apps/web/` or any `NEXT_PUBLIC_*` variable.

## Project Conventions

### Code Style
- **Prettier**: `{ semi: true, singleQuote: true, trailingComma: "all", printWidth: 100 }`
- **TypeScript**: Strict mode enabled
- **Validation**: Zod via `ZodValidationPipe` (no `class-validator`)
- **Error Format**: RFC 7807 Problem Details

### Module Pattern
New association-scoped modules should follow the pattern in `apps/api/src/modules/tasks/`:
1. Module with `PrismaModule` import
2. Controller with guard chain: `AuthGuard → SupabaseUserGuard → AssociationRolesGuard`
3. Service with `associationId` AND `deletedAt: null` filtering
4. Zod schemas in `libs/shared-validation/src/schemas/`
5. DTOs in `libs/shared-types/src/domain/`

## Domain Model Overview

### Core Entities
| Model | Purpose |
|-------|---------|
| `User` | Global identity with Supabase linkage |
| `Association` | Association (dernek) - tenant root |
| `AssociationMembership` | Role assignment within an association |
| `MemberTitleDefinition` | System-admin-managed title catalog |
| `Task` | Per-association tasks with assignment |
| `TaskActivity` | Audit trail for task changes |
| `MeetingNote` | Meeting records with attendees |
| `Event` | Events with recurrence and notifications |
| `EventRoleDefinition` | Per-association event role catalog |
| `EventAssignment` | Member-to-event-role assignments |
| `Transaction` | Financial transactions (income/expense) |
| `TransactionCategory` | Transaction categorization |
| `AiSuggestion` | AI-generated event suggestions |
| `TelegramAccount` | Telegram user linkage |
| `TelegramLinkToken` | Short-lived tokens for bot linking |

### Key Invariants
- Multi-tenancy via `associationId` on all tenant-scoped models
- Soft-delete mandatory: all queries must filter `deletedAt: null`
- One active başkan (manager) per association enforced by partial unique index
- Task assignees must have linked Telegram accounts for notifications

## Known Limitations & Planned Features

### Stubbed/Not Yet Implemented
- **Task notification scheduler** - BullMQ jobs for reminders
- **Meeting-to-task extraction** - Converting meeting notes to tasks
- **Web test harness** - No Jest/Vitest config for Next.js app
- **Playwright E2E** - No browser-based end-to-end tests
- **Finance permissions** - Schema exists, implementation partial
- **Meeting permissions** - Schema exists, implementation partial

### Architecture Notes
- Bot runs inside API process, not as a separate server
- Two role guards (`RolesGuard`, `AssociationRolesGuard`) both return `true` by default - always decorate handlers
- Auth dual-mode: distinguishes Supabase JWT from bot token via `alg` header
- Provisioning saga requires atomic Supabase + DB user creation with rollback
