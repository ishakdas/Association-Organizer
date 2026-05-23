# System Architecture

## Architecture Overview

Association Organizer follows a **monorepo architecture** with three main applications sharing common libraries. The system is designed for multi-tenant association management with role-based access control, Telegram bot integration, and AI-powered features.

```
┌─────────────────────────────────────────────────────────────┐
│                        Clients                               │
├──────────────────────┬──────────────────────────────────────┤
│   Web App (Next.js)  │   Telegram Bot (Mobile Users)        │
│   Port: 3001         │   Webhook: /telegram/webhook         │
└──────────┬───────────┴──────────────┬───────────────────────┘
           │                          │
           │ HTTPS                    │ HTTPS
           │                          │
┌──────────▼──────────────────────────▼───────────────────────┐
│                    API Server (NestJS)                       │
│                    Port: 3000                                │
│                    Prefix: api/v1                            │
├──────────────────────────────────────────────────────────────┤
│  ┌────────────┐  ┌────────────┐  ┌───────────────────────┐  │
│  │   Auth     │  │  Modules   │  │   Bot (Telegraf)      │  │
│  │   Module   │  │  (16+)     │  │   (Inside Process)    │  │
│  └────────────┘  └────────────┘  └───────────────────────┘  │
├──────────────────────────────────────────────────────────────┤
│                    Common Layer                              │
│  Guards │ Filters │ Pipes │ Decorators │ Interceptors        │
└──────────────────────────┬───────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────┐
│                    Data Layer                                │
├──────────────────────┬───────────────────────────────────────┤
│   Prisma ORM         │   Redis (BullMQ - stubbed)           │
│   (PostgreSQL)       │                                       │
└──────────┬───────────┴──────────────┬───────────────────────┘
           │                          │
┌──────────▼──────────┐   ┌──────────▼───────────────────────┐
│  Supabase (DB)      │   │  OpenAI API                      │
│  - PostgreSQL       │   │  (AI Suggestions)                │
│  - Auth             │   │                                   │
└─────────────────────┘   └──────────────────────────────────┘
```

## Application Architecture

### 1. API Server (apps/api)

**Framework**: NestJS 11 on Fastify

**Structure**:
```
apps/api/
├── src/
│   ├── main.ts                 # Application bootstrap
│   ├── app.module.ts           # Root module
│   ├── config/                 # Configuration
│   │   └── configuration.ts    # Environment config loader
│   │   └── env.validation.ts   # Zod env validation
│   ├── common/                 # Shared utilities
│   │   ├── decorators/         # Custom decorators
│   │   ├── filters/            # Exception filters
│   │   ├── guards/             # Auth & role guards
│   │   └── pipes/              # Validation pipes
│   ├── modules/                # Feature modules
│   │   ├── auth/               # Authentication
│   │   ├── users/              # User management
│   │   ├── associations/       # Association CRUD
│   │   ├── tasks/              # Task management
│   │   ├── meetings/           # Meeting notes
│   │   ├── events/             # Event management
│   │   ├── event-roles/        # Event role definitions
│   │   ├── finance/            # Financial tracking
│   │   ├── titles/             # Title catalog
│   │   ├── ai-helper/          # AI suggestions
│   │   ├── islamic-calendar/   # Islamic calendar
│   │   ├── admin/              # Admin features
│   │   ├── email/              # Email service
│   │   ├── jobs/               # BullMQ queues (stubbed)
│   │   ├── supabase/           # Supabase admin client
│   │   └── health/             # Health checks
│   └── types/                  # Type definitions
├── test/                       # Test files
└── tsconfig.json
```

**Key Characteristics**:
- Global API prefix: `api/v1`
- Runs on port 3000
- Uses Fastify adapter for performance
- Bot webhook mounted at `/telegram/webhook` (outside `api/v1` prefix)
- Environment validation on boot via Zod

### 2. Web Application (apps/web)

**Framework**: Next.js 15 App Router

**Structure**:
```
apps/web/
├── src/
│   ├── app/                    # App Router pages
│   │   ├── (auth)/             # Auth routes (login, callback)
│   │   ├── (onboarding)/       # Onboarding flow
│   │   ├── (protected)/        # Authenticated routes
│   │   │   ├── admin/          # Admin panel
│   │   │   ├── associations/   # Association pages
│   │   │   ├── dashboard/      # Dashboard
│   │   │   ├── events/         # Event management
│   │   │   ├── settings/       # User settings
│   │   │   └── tasks/          # Task management
│   │   ├── layout.tsx          # Root layout
│   │   └── page.tsx            # Landing page
│   ├── lib/                    # Utilities
│   │   ├── api/                # API client
│   │   ├── supabase/           # Supabase clients
│   │   └── permissions.ts      # Role-based permissions
│   └── components/             # React components
├── public/                     # Static assets
└── middleware.ts               # Auth middleware
```

**Key Characteristics**:
- Runs on port 3001
- Server Components for data fetching
- Supabase SSR for authentication
- Role-based UI rendering via `permissions.ts`
- Route groups for auth flow organization

### 3. Telegram Bot (apps/bot)

**Framework**: Telegraf

**Structure**:
```
apps/bot/
├── src/
│   ├── index.ts                # Module export
│   ├── bot.module.ts           # NestJS module
│   ├── bot.service.ts          # Bot service
│   ├── main.ts                 # Bot initialization
│   ├── commands/               # Bot commands
│   ├── handlers/               # Event handlers
│   ├── keyboards/              # Inline keyboards
│   └── wizards/                # Multi-step conversations
└── package.json
```

**Key Characteristics**:
- Runs inside the API process (not a separate server)
- Webhook endpoint: `/telegram/webhook`
- Handles user linking via `/link` command
- Sends task notifications and event reminders
- Uses inline keyboards for interactions

## Shared Libraries

### @ticketbot/database
```
libs/database/
├── prisma/
│   ├── schema.prisma           # Database schema
│   └── migrations/             # Database migrations
└── src/
    ├── prisma.service.ts       # PrismaService
    └── prisma.module.ts        # PrismaModule
```

### @ticketbot/shared-types
```
libs/shared-types/
└── src/
    ├── index.ts                # Re-exports
    ├── authenticated-user.ts   # Auth types
    └── domain/                 # Domain DTOs
```

### @ticketbot/shared-validation
```
libs/shared-validation/
└── src/
    ├── index.ts                # Re-exports
    └── schemas/                # Zod validation schemas
```

### @ticketbot/core
```
libs/core/
└── src/
    # Shared business logic and utilities
```

### @ticketbot/ai
```
libs/ai/
└── src/
    ├── ai-provider.ts          # Provider interface
    ├── openai.provider.ts      # OpenAI implementation
    └── fake.provider.ts        # Mock implementation
```

## Data Flow

### Web User Flow
```
User → Web App (Next.js)
  → Supabase Auth (login)
  → API Request (with JWT)
    → AuthGuard (validate JWT)
    → SupabaseUserGuard (verify user)
    → AssociationRolesGuard (check permissions)
    → Controller Handler
    → Service (Prisma query)
    → Response
```

### Bot User Flow
```
User → Telegram
  → Bot Command/Action
    → Webhook → API (/telegram/webhook)
      → Bot Service
        → AuthGuard (bot JWT)
        → Service (Prisma query)
        → Telegram Response
```

### Task Assignment Flow
```
Manager/Secretary (Web)
  → Create Task API
    → Validate assignee has TelegramAccount
    → Create Task (Prisma)
    → Create TaskActivity
    → (Future) Queue notification job
  → Bot sends Telegram notification to assignee
```

## Multi-Tenancy Model

The system implements **row-level multi-tenancy**:

```
┌─────────────────────────────────────────────────┐
│                  Database                        │
├─────────────────────────────────────────────────┤
│  User (global)                                   │
│  ├── Association A                               │
│  │   ├── AssociationMembership (users)           │
│  │   ├── Tasks                                   │
│  │   ├── Meetings                                │
│  │   ├── Events                                  │
│  │   └── Transactions                            │
│  ├── Association B                               │
│  │   ├── AssociationMembership (users)           │
│  │   ├── Tasks                                   │
│  │   ├── Meetings                                │
│  │   ├── Events                                  │
│  │   └── Transactions                            │
│  └── ...                                         │
└─────────────────────────────────────────────────┘
```

**Key Rules**:
- All tenant-scoped queries filter by `associationId`
- All tenant-scoped queries filter by `deletedAt: null`
- `AssociationMembership` is the join table granting access
- Users can belong to multiple associations with different roles

## Security Architecture

### Authentication Layers
1. **Supabase JWT** - Web users (signed with `SUPABASE_JWT_SECRET`)
2. **Bot JWT** - Telegram users (signed with `JWT_SECRET`)
3. **Token Type Detection** - Via JWT `alg` header inspection

### Authorization Guards
```
System-scoped endpoints:
  AuthGuard → SupabaseUserGuard → RolesGuard

Association-scoped endpoints:
  AuthGuard → SupabaseUserGuard → AssociationRolesGuard
```

### Guard Chain Details
- **AuthGuard**: Validates JWT, attaches `AuthenticatedUser` to request
- **SupabaseUserGuard**: Ensures Supabase user has DB row
- **RolesGuard**: Checks system-level roles
- **AssociationRolesGuard**: Checks association-specific roles

## Error Handling

All errors follow **RFC 7807 Problem Details** format:

```json
{
  "type": "string",
  "title": "string",
  "status": number,
  "detail": "string",
  "instance": "string",
  "errors": [] // optional validation errors
}
```

Implemented via global `HttpExceptionFilter`.

## Validation Strategy

- **Zod schemas** defined in `libs/shared-validation`
- **ZodValidationPipe** applied per-controller (not globally)
- **createZodDto** pattern - schema comes from DTO class
- **No class-validator** used in the project

## Module Pattern

### Association-Scoped Module Template
```
modules/x/
├── x.module.ts          # Imports PrismaModule, provides controller + service
├── x.controller.ts      # @Controller('associations/:associationId/x')
│                        # Guards: AuthGuard → SupabaseUserGuard → AssociationRolesGuard
│                        # Every handler decorated with @AssociationRoles(...)
└── x.service.ts         # All queries filtered by associationId AND deletedAt: null
```

### System-Scoped Module Template
```
modules/x/
├── x.module.ts          # Imports PrismaModule, provides controller + service
├── x.controller.ts      # @Controller('x')
│                        # Guards: AuthGuard → SupabaseUserGuard → RolesGuard
│                        # Every handler decorated with @Roles(...)
└── x.service.ts         # System-level queries
```

## Communication Patterns

### Internal (Process-Level)
- Bot runs inside API process
- Direct service imports
- Shared Prisma instance

### External
- Web → API via HTTP (apiClient with JWT)
- Telegram → API via webhook
- API → Supabase via admin client
- API → OpenAI via SDK

## Scaling Considerations

### Current Architecture
- Single API process (bot included)
- Single web instance
- Managed PostgreSQL (Supabase)
- Redis for future job queues

### Future Scaling
- Bot could be extracted to separate process
- BullMQ for async job processing
- Redis caching layer
- Database read replicas
