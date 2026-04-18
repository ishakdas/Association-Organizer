# Database Schema Reference

## Entity Relationship Diagram

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   Organisation   │     │      User        │     │ TelegramAccount  │
├──────────────────┤     ├──────────────────┤     ├──────────────────┤
│ id          cuid │◄──┐ │ id          cuid │◄──┐ │ id          cuid │
│ name      string │   │ │ email     string │   │ │ telegramId BigInt│
│ slug      string │   │ │ name      string?│   │ │ username  string?│
│ createdAt    dt  │   │ │ avatarUrl string?│   │ │ firstName string?│
│ updatedAt    dt  │   │ │ supabaseId string│   └─│ userId    string │
└──────────────────┘   │ │ createdAt    dt  │     │ createdAt    dt  │
         │             │ │ updatedAt    dt  │     └──────────────────┘
         │             │ └──────────────────┘
         │             │          │
         │             │          │
    ┌────▼─────────────▼──┐       │
    │     Membership      │       │    ┌──────────────────────┐
    ├─────────────────────┤       │    │ TelegramLinkToken    │
    │ id            cuid  │       │    ├──────────────────────┤
    │ role          Role  │       │    │ id            cuid   │
    │ organisationId str  │       │    │ token         string │
    │ userId         str  │       │    │ userId        string │
    │ createdAt       dt  │       │    │ expiresAt       dt   │
    └─────────────────────┘       │    │ usedAt         dt?   │
                                  │    │ createdAt       dt   │
    ┌─────────────────────┐       │    └──────────────────────┘
    │       Ticket        │       │
    ├─────────────────────┤       │
    │ id            cuid  │       │    ┌──────────────────────┐
    │ title        string │       │    │   TicketComment      │
    │ description  string?│       │    ├──────────────────────┤
    │ status  TicketStatus│       │    │ id            cuid   │
    │ priority  Priority  │       │    │ content       string │
    │ organisationId str  │       ├───▶│ authorId      string │
    │ creatorId      str  │───────┤    │ ticketId      string │
    │ assigneeId    str?  │───────┘    │ createdAt       dt   │
    │ dueDate        dt?  │            │ updatedAt       dt   │
    │ createdAt       dt  │            └──────────────────────┘
    │ updatedAt       dt  │
    │ deletedAt      dt?  │◄── soft delete
    └─────────────────────┘
         │         │
         │         │
    ┌────▼──────┐  │  ┌────────────────────────┐
    │TicketStat │  │  │DeadlineExtensionRequest│
    │ usHistory │  │  ├────────────────────────┤
    ├───────────┤  └─▶│ id              cuid   │
    │ id   cuid │     │ ticketId        string │
    │ ticketId  │     │ requesterId     string │
    │ fromStatus│     │ currentDeadline   dt   │
    │ toStatus  │     │ requestedDeadline dt   │
    │ changedAt │     │ reason          string │
    └───────────┘     │ approved       bool?   │
                      │ resolvedAt       dt?   │
                      │ createdAt         dt   │
                      └────────────────────────┘

    ┌─────────────────────┐     ┌──────────────────────┐
    │    MeetingNote       │     │ ExtractedActionItem  │
    ├─────────────────────┤     ├──────────────────────┤
    │ id            cuid  │◄───▶│ id            cuid   │
    │ title        string │     │ meetingNoteId string │
    │ content      string │     │ content       string │
    │ organisationId str  │     │ assigneeName  string?│
    │ createdAt       dt  │     │ ticketId     string? │
    │ updatedAt       dt  │     │ createdAt       dt   │
    │ deletedAt      dt?  │     └──────────────────────┘
    └─────────────────────┘

    ┌─────────────────────┐     ┌──────────────────────┐
    │     AuditLog        │     │  NotificationLog     │
    ├─────────────────────┤     ├──────────────────────┤
    │ id            cuid  │     │ id            cuid   │
    │ action       string │     │ channel       string │
    │ entityType   string │     │ recipientId   string │
    │ entityId     string │     │ organisationId str   │
    │ userId       string?│     │ subject       string │
    │ organisationId str  │     │ body          string │
    │ metadata      json? │     │ sentAt          dt   │
    │ createdAt       dt  │     │ deliveredAt    dt?   │
    └─────────────────────┘     │ failedAt       dt?   │
                                │ errorMessage  string?│
                                └──────────────────────┘
```

## Enums

### Role
| Value | Description |
|-------|-------------|
| `SUPER_ADMIN` | Full system access, can manage org settings and all members |
| `ADMIN` | Can manage tickets, members, and most settings |
| `MANAGER` | Can approve extensions, manage tickets assigned to their team |
| `MEMBER` | Can create/view tickets, add comments |

### TicketStatus
| Value | Description |
|-------|-------------|
| `OPEN` | Newly created, not yet started |
| `IN_PROGRESS` | Actively being worked on |
| `WAITING` | Blocked, pending extension approval or external input |
| `RESOLVED` | Work complete, pending verification |
| `CLOSED` | Verified complete, archived |
| `REOPENED` | Was closed/resolved, but reopened due to issues |

### TicketPriority
| Value | Description |
|-------|-------------|
| `LOW` | No urgency, can be done when time permits |
| `MEDIUM` | Standard priority (default) |
| `HIGH` | Should be addressed soon |
| `URGENT` | Requires immediate attention |

## Models

### Organisation
The top-level tenant. All data is scoped to an organisation.

| Field | Type | Notes |
|-------|------|-------|
| `id` | cuid | Primary key |
| `name` | string | Display name |
| `slug` | string | URL-safe unique identifier |
| `createdAt` | datetime | Auto-set |
| `updatedAt` | datetime | Auto-updated |

### User
A human user, identified by their Supabase Auth account.

| Field | Type | Notes |
|-------|------|-------|
| `id` | cuid | Primary key (internal) |
| `email` | string | Unique, from Supabase Auth |
| `name` | string? | Display name |
| `avatarUrl` | string? | Profile image URL |
| `supabaseId` | string | Unique, links to Supabase Auth user ID |

Users belong to organisations through `Membership`. A user can be in multiple orgs.

### Membership
Join table between User and Organisation, with a role.

| Field | Type | Notes |
|-------|------|-------|
| `id` | cuid | Primary key |
| `role` | Role | Default: `MEMBER` |
| `organisationId` | string | FK → Organisation |
| `userId` | string | FK → User |

**Unique constraint:** `(organisationId, userId)` — a user can only have one role per org.

### TelegramAccount
Links a Telegram user to an internal User.

| Field | Type | Notes |
|-------|------|-------|
| `telegramId` | BigInt | Telegram user ID (unique) |
| `username` | string? | Telegram @username |
| `firstName` | string? | Telegram first name |
| `userId` | string | FK → User (unique — one Telegram per user) |

### TelegramLinkToken
Short-lived one-time tokens for linking Telegram accounts.

| Field | Type | Notes |
|-------|------|-------|
| `token` | string | Random hex string (unique) |
| `userId` | string | The User this token will link to |
| `expiresAt` | datetime | 10 minutes from creation |
| `usedAt` | datetime? | Set when redeemed (null = unused) |

### Ticket
The core work item. Soft-deletable.

| Field | Type | Notes |
|-------|------|-------|
| `status` | TicketStatus | Default: `OPEN` |
| `priority` | TicketPriority | Default: `MEDIUM` |
| `organisationId` | string | FK → Organisation (tenant scope) |
| `creatorId` | string | FK → User (who created it) |
| `assigneeId` | string? | FK → User (who's responsible) |
| `dueDate` | datetime? | Optional deadline |
| `deletedAt` | datetime? | Soft delete flag |

### TicketStatusHistory
Audit trail of all status changes on a ticket.

| Field | Type | Notes |
|-------|------|-------|
| `ticketId` | string | FK → Ticket |
| `fromStatus` | TicketStatus? | Null for initial creation |
| `toStatus` | TicketStatus | The new status |
| `changedAt` | datetime | When the transition happened |

### DeadlineExtensionRequest
Request to push a ticket's deadline.

| Field | Type | Notes |
|-------|------|-------|
| `ticketId` | string | FK → Ticket |
| `requesterId` | string | FK → User |
| `currentDeadline` | datetime | Deadline at time of request |
| `requestedDeadline` | datetime | Proposed new deadline |
| `reason` | string | Justification |
| `approved` | boolean? | Null = pending, true = approved, false = rejected |
| `resolvedAt` | datetime? | When approved/rejected |

### MeetingNote
Meeting notes from which AI can extract action items. Soft-deletable.

| Field | Type | Notes |
|-------|------|-------|
| `title` | string | Meeting title |
| `content` | string | Full meeting notes text |
| `organisationId` | string | FK → Organisation |
| `deletedAt` | datetime? | Soft delete flag |

### ExtractedActionItem
AI-extracted action items from meeting notes.

| Field | Type | Notes |
|-------|------|-------|
| `meetingNoteId` | string | FK → MeetingNote |
| `content` | string | Description of the action |
| `assigneeName` | string? | Name mentioned in notes (not an FK) |
| `ticketId` | string? | FK → Ticket if a ticket was created from this item |

### AuditLog
Immutable log of significant actions for compliance and debugging.

| Field | Type | Notes |
|-------|------|-------|
| `action` | string | e.g., `ticket.created`, `membership.updated` |
| `entityType` | string | e.g., `Ticket`, `User` |
| `entityId` | string | ID of the affected entity |
| `userId` | string? | Who performed the action (null for system actions) |
| `organisationId` | string | Tenant scope |
| `metadata` | json? | Arbitrary context (e.g., changed fields) |

### NotificationLog
Record of all notifications sent through any channel.

| Field | Type | Notes |
|-------|------|-------|
| `channel` | string | `telegram`, `email`, or `web` |
| `recipientId` | string | User ID or Telegram ID |
| `organisationId` | string | Tenant scope |
| `subject` | string | Notification title/subject |
| `body` | string | Notification content |
| `sentAt` | datetime | When sent |
| `deliveredAt` | datetime? | Delivery confirmation |
| `failedAt` | datetime? | If delivery failed |
| `errorMessage` | string? | Error details on failure |

## Indexes

Key indexes for query performance:

| Table | Index | Purpose |
|-------|-------|---------|
| Ticket | `(organisationId, status, dueDate)` | List tickets by org filtered by status, sorted by deadline |
| Ticket | `(assigneeId, status)` | "My tickets" query for a user |
| Ticket | `(deletedAt)` | Exclude soft-deleted tickets |
| AuditLog | `(organisationId, createdAt DESC)` | Audit log timeline for an org |
| AuditLog | `(entityType, entityId)` | History of a specific entity |
| Membership | `(organisationId, userId)` UNIQUE | Enforce one membership per user per org |

## Seed Data

Running `pnpm db:seed` creates:

| Entity | Data |
|--------|------|
| Organisation | "Acme Corp" (slug: `acme-corp`) |
| Users | Sarah Super (SUPER_ADMIN), Alex Admin (ADMIN), Mike Manager (MANAGER), Mary Member (MEMBER) |
| Tickets | "Fix login page redirect" (OPEN, HIGH), "Update onboarding flow" (IN_PROGRESS, MEDIUM), "Upgrade database" (RESOLVED, LOW) |
| Comments | 1 comment on the login ticket from Mary |
| StatusHistory | Full history for all 3 tickets |
| AuditLog | 3 `ticket.created` entries |

Seed data uses placeholder `supabaseId` values (`supabase-super-admin-001`, etc.). In real use, these must match actual Supabase Auth user IDs.

## Known Issues & Planned Changes

| Issue | Description | Link |
|-------|-------------|------|
| ExtractedActionItem → Ticket relation | `ticketId` field has no Prisma relation defined | [#25](https://github.com/ishakdas/Association-Organizer/issues/25) |
| Soft-delete client extension | Auto-filter `deletedAt IS NULL` via Prisma extension | [#31](https://github.com/ishakdas/Association-Organizer/issues/31) |
| Row-Level Security | Add Postgres RLS as defense-in-depth for tenancy | [#22](https://github.com/ishakdas/Association-Organizer/issues/22) |
| Connection pooling | Configure Supabase pooler + `DIRECT_DATABASE_URL` | [#48](https://github.com/ishakdas/Association-Organizer/issues/48) |
| Data retention | Cleanup policy for AuditLog and NotificationLog | [#57](https://github.com/ishakdas/Association-Organizer/issues/57) |
| Token cleanup | Delete expired/used TelegramLinkTokens | [#45](https://github.com/ishakdas/Association-Organizer/issues/45) |
| Backup strategy | Verify Supabase backups, document restore procedure | [#42](https://github.com/ishakdas/Association-Organizer/issues/42) |
| File attachments | New `Attachment` model for tickets/notes/comments | [#54](https://github.com/ishakdas/Association-Organizer/issues/54) |
| Org deletion | Define cascade/soft-delete/archive strategy | [#51](https://github.com/ishakdas/Association-Organizer/issues/51) |
