# Architecture Overview

## System Diagram

```
                    ┌─────────────────────────────────────────────────────┐
                    │                    Railway                          │
                    │                                                     │
┌──────────┐       │  ┌─────────────────────────────────────────────┐    │
│ Telegram │       │  │           NestJS API (Fastify)               │    │
│ Servers  │───────┼─▶│                                             │    │
│          │ POST  │  │  /telegram/webhook ──▶ BotService            │    │
│          │webhook│  │                        (Telegraf)            │    │
└──────────┘       │  │  /api/v1/tickets   ──▶ TicketsController    │    │
                    │  │  /api/v1/auth      ──▶ AuthController       │    │
┌──────────┐       │  │  /api/v1/...       ──▶ Other Controllers    │    │
│  Vercel  │       │  │                                             │    │
│          │       │  │  ┌────────┐ ┌────────────┐ ┌────────────┐  │    │
│ Next.js  │───────┼─▶│  │AuthGuard│ │TenantGuard │ │RolesGuard  │  │    │
│ Web App  │ HTTP  │  │  └────────┘ └────────────┘ └────────────┘  │    │
│          │       │  │                                             │    │
└──────────┘       │  │  ┌─────────────────────────────────────┐   │    │
                    │  │  │         PrismaService               │   │    │
                    │  │  │         (Database access)            │───┼────┼──▶ Supabase PostgreSQL
                    │  │  └─────────────────────────────────────┘   │    │
                    │  │                                             │    │
                    │  │  ┌─────────────────────────────────────┐   │    │
                    │  │  │         BullMQ Workers              │   │    │
                    │  │  │         (Background jobs)            │───┼────┼──▶ Railway Redis
                    │  │  └─────────────────────────────────────┘   │    │
                    │  └─────────────────────────────────────────────┘    │
                    └─────────────────────────────────────────────────────┘
```

## Key Design Decisions

### Bot Runs Inside the API Process

The Telegraf bot is **not** a separate service. It's a NestJS module (`BotModule`) imported by the API's `AppModule`. Telegraf's update handler is mounted as a raw Fastify route at `/telegram/webhook`, outside the `/api/v1` prefix.

**Why:** Single Railway service, shared database connection, simpler ops, no inter-service communication needed.

**Trade-off:** If the bot needs to scale independently of the API, it would need to be extracted into its own service. This is unlikely in v1.

### Dual Authentication

```
Web User Flow:
  Browser → Supabase Auth → JWT (sub = supabaseId) → API AuthGuard → User lookup

Bot User Flow:
  Telegram → /link <token> → API issues HS256 JWT (sub = userId) → Bot sends JWT → API AuthGuard
```

The `AuthGuard` checks the JWT's `alg` header to decide the verification path:
- Non-HS256 → Verify with `SUPABASE_JWT_SECRET`, look up user by `supabaseId`
- HS256 → Verify with `JWT_SECRET`, look up user by `supabaseId` (from `sub` claim)

Both paths result in a `RequestUser { id, email, supabaseId }` attached to the request.

### Multi-Tenancy via Application Layer

Every tenant-scoped table has an `organisationId` column. Tenancy is enforced by:

1. **TenantGuard** — reads `x-organisation-id` header, verifies the user's Membership
2. **Service layer** — all queries include `WHERE organisationId = ?`

No PostgreSQL Row-Level Security (RLS) in v1. This is a deliberate simplification. RLS can be added later as defense-in-depth without changing the application code. See [#22](https://github.com/ishakdas/Association-Organizer/issues/22).

### Shared Validation with Zod

```
libs/shared-validation/
  └── schemas/
      ├── ticket.schema.ts      ← Zod schema + inferred type
      └── ...

apps/api/
  └── controllers/
      └── tickets.controller.ts ← Uses ZodValidationPipe(createTicketSchema)

apps/web/
  └── components/
      └── create-ticket-form.tsx ← Can use the same schema for client-side validation
```

The same Zod schema validates on both server and client. If the schema changes, TypeScript catches any mismatches at compile time.

### AI Provider Pattern

```typescript
interface AiProvider {
  generateStructured<T>(options: GenerateStructuredOptions<T>): Promise<T>;
}
```

Implementations:
- `OpenAiProvider` — calls OpenAI's structured outputs API, validates response with Zod, retries once on parse failure
- `FakeAiProvider` — returns pre-configured responses for testing

The provider is injected via NestJS DI using the `AI_PROVIDER` symbol. To swap providers, change the factory in `AiModule`.

## Data Flow Examples

### Creating a Ticket (Web → API)

```
1. User fills form in Next.js
2. Client validates with createTicketSchema (Zod)
3. POST /api/v1/tickets with Supabase JWT + x-organisation-id
4. AuthGuard verifies JWT, attaches user
5. TenantGuard verifies membership, attaches orgId
6. ZodValidationPipe validates body with createTicketSchema
7. TicketsService.create() inserts Ticket + TicketStatusHistory
8. 201 response with created ticket
```

### Linking Telegram Account

```
1. User clicks "Generate Link Code" on web dashboard
2. Web calls POST /api/v1/auth/telegram-link (Supabase JWT)
3. API generates random token, stores with userId + 10min expiry
4. User copies token, sends /link <token> to bot
5. Bot command handler calls PrismaService directly:
   a. Finds token, validates not expired/used
   b. Creates TelegramAccount linking telegramId → userId
   c. Marks token as used
6. Bot replies "Account linked successfully!"
```

### Ticket Reminder (Future — BullMQ) ([#7](https://github.com/ishakdas/Association-Organizer/issues/7))

```
1. BullMQ cron job scans tickets with dueDate approaching
2. For each ticket, finds assignee's TelegramAccount
3. Sends Telegram message with inline keyboard via BotService
4. User taps "Done" → callback query handler updates ticket status
5. User taps "Request Extension" → starts extension flow (#14)
```

## Package Dependency Graph

```
apps/api ──▶ libs/database
         ──▶ libs/shared-types
         ──▶ libs/shared-validation
         ──▶ libs/core
         ──▶ libs/ai
         ──▶ apps/bot (as NestJS module)

apps/bot ──▶ libs/database
         ──▶ libs/shared-types
         ──▶ libs/core

apps/web ──▶ libs/shared-types
         ──▶ libs/shared-validation

libs/shared-validation ──▶ libs/shared-types

libs/ai ──▶ libs/shared-validation

libs/database ──▶ (standalone — Prisma only)
libs/core ──▶ libs/shared-types
```

The web app intentionally does NOT depend on `libs/database` — it accesses data through the API only.

## Security Model

### Input Validation
- All API inputs are validated by Zod schemas via `ZodValidationPipe`
- Validation errors return RFC 7807 format with per-field error details
- No raw user input reaches the database

### Authentication
- JWTs are verified cryptographically (not just decoded)
- Bot tokens use a separate secret from Supabase tokens
- Link tokens are one-time-use with 10-minute expiry

### Authorization
- `TenantGuard` prevents cross-tenant data access
- `RolesGuard` enforces minimum role requirements
- Service layer always scopes queries by `organisationId`

### Data Protection
- Soft delete preserves data (Ticket, MeetingNote)
- AuditLog tracks who did what and when
- No sensitive data (passwords, secrets) stored in the application database — auth is delegated to Supabase

### What's NOT in v1 (Tracked Issues)
- Rate limiting — [#20](https://github.com/ishakdas/Association-Organizer/issues/20)
- Telegram webhook secret validation — [#21](https://github.com/ishakdas/Association-Organizer/issues/21)
- Postgres RLS (defense-in-depth) — [#22](https://github.com/ishakdas/Association-Organizer/issues/22)
- Token revocation / logout — [#23](https://github.com/ishakdas/Association-Organizer/issues/23)
- GDPR compliance — [#58](https://github.com/ishakdas/Association-Organizer/issues/58)
- CSRF protection (not needed — API uses Bearer tokens, not cookies)
- Input sanitization for XSS (handled by React's default escaping)

See [Roadmap](ROADMAP.md) for the full list of 62 tracked issues across all phases.
