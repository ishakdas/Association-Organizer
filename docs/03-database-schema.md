# Database Schema

## Overview

The database schema is defined in `libs/database/prisma/schema.prisma` using Prisma ORM. The database is PostgreSQL hosted on Supabase.

## Enums

### UserRole
Defines the role hierarchy within the system.

| Value | Description |
|-------|-------------|
| `SYSTEM_ADMIN` | Full system access, bypasses all role guards |
| `ASSOCIATION_MANAGER` | Association president (Başkan) - full association control |
| `ASSOCIATION_SECRETARY` | Association secretary (Sekreter) - most management capabilities |
| `ASSOCIATION_MEMBER` | Regular member - read access, own task management |

### TaskStatus
Task lifecycle states.

| Value | Description |
|-------|-------------|
| `PENDING` | Task not started |
| `IN_PROGRESS` | Task being worked on |
| `COMPLETED` | Task finished |
| `CANCELLED` | Task cancelled |

### TaskPriority
Task urgency levels.

| Value | Description |
|-------|-------------|
| `LOW` | Low priority |
| `MEDIUM` | Default priority |
| `HIGH` | High priority |

### ReminderFrequency
Task reminder scheduling.

| Value | Description |
|-------|-------------|
| `NONE` | No reminders |
| `ONCE` | One-time reminder |
| `DAILY` | Daily reminders |
| `WEEKLY` | Weekly reminders |
| `MONTHLY` | Monthly reminders |

### TaskActivityAction
Audit trail action types.

| Value | Description |
|-------|-------------|
| `CREATED` | Task created |
| `REASSIGNED` | Task reassigned |
| `STATUS_CHANGED` | Status updated |
| `PRIORITY_CHANGED` | Priority updated |
| `DUE_DATE_CHANGED` | Due date modified |
| `DESCRIPTION_CHANGED` | Description updated |
| `TITLE_CHANGED` | Title updated |
| `REMINDER_CHANGED` | Reminder settings changed |
| `REMINDER_SENT` | Reminder notification sent |
| `ASSIGNED_NOTIFIED` | Assignee notified |
| `ASSIGNMENT_ACCEPTED` | Assignment accepted |
| `REASSIGNMENT_REQUESTED` | Reassignment requested |
| `REASSIGNMENT_RESOLVED` | Reassignment resolved |

### EventType
Event classification.

| Value | Description |
|-------|-------------|
| `CONFERENCE` | Conference event |
| `TALK` | Talk/presentation |
| `SEMINAR` | Seminar |
| `IFTAR` | Iftar dinner |
| `KANDIL` | Kandil (Islamic holy night) |
| `MEETING` | Meeting |
| `CUSTOM` | Custom event type |

### RecurrenceType
Event recurrence patterns.

| Value | Description |
|-------|-------------|
| `NONE` | No recurrence |
| `DAILY` | Daily recurrence |
| `WEEKLY` | Weekly recurrence |
| `MONTHLY` | Monthly recurrence |

### PendingBranchStatus
Branch registration workflow states.

| Value | Description |
|-------|-------------|
| `PENDING` | Awaiting review |
| `APPROVED` | Approved |
| `REJECTED` | Rejected |

### TransactionType
Financial transaction classification.

| Value | Description |
|-------|-------------|
| `INCOME` | Income/gelir |
| `EXPENSE` | Expense/gider |

## Models

### User
Global user identity. Links to Supabase auth or exists as DB-only member.

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Primary key |
| `supabaseUserId` | String? (unique) | Links to Supabase auth.users.id |
| `email` | String? (unique) | User email |
| `fullName` | String | Display name |
| `phone` | String? | Phone number |
| `address` | String? | Address |
| `isActive` | Boolean | Active status (default: true) |
| `onboardingCompletedAt` | DateTime? | Onboarding completion timestamp |
| `mustChangePassword` | Boolean | Password change required (default: false) |
| `createdAt` | DateTime | Creation timestamp |
| `updatedAt` | DateTime | Last update timestamp |
| `deletedAt` | DateTime? | Soft delete timestamp |

**Indexes**: `isActive`, `deletedAt`

**Relations**:
- `memberships` → AssociationMembership[]
- `assignedTasks` → Task[] (as assignee)
- `createdTasks` → Task[] (as creator)
- `watchedTasks` → Task[] (as watcher)
- `createdMeetings` → MeetingNote[]
- `attendedMeetings` → MeetingAttendee[]
- `createdAssociations` → Association[]
- `taskActivities` → TaskActivity[]
- `createdEvents` → Event[]
- `telegramAccount` → TelegramAccount?
- `aiSuggestions` → AiSuggestion[]
- `savedSuggestions` → SavedSuggestion[]
- `financePermissionsGranted` → FinancePermission[]
- `financePermissionsReceived` → FinancePermission[]
- `meetingPermissionsGranted` → MeetingPermission[]
- `meetingPermissionsReceived` → MeetingPermission[]
- `createdTransactions` → Transaction[]

**Key Design**: `supabaseUserId` is NOT a foreign key - it's a stored UUID linking to Supabase auth.users. DB-only members have `supabaseUserId: null`.

### PendingBranchRegistration
Tracks branch registration requests awaiting admin review.

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Primary key |
| `email` | String (unique) | Contact email |
| `fullName` | String | Contact name |
| `phone` | String? | Contact phone |
| `city` | String | City (default: "") |
| `district` | String | District (default: "") |
| `message` | String? | Additional message |
| `status` | PendingBranchStatus | Review status (default: PENDING) |
| `reviewedBy` | String? | Reviewer user ID |
| `reviewedAt` | DateTime? | Review timestamp |
| `createdAt` | DateTime | Creation timestamp |
| `updatedAt` | DateTime | Last update timestamp |

**Indexes**: `status`

### TelegramAccount
Links a Telegram user to a system User.

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Primary key |
| `telegramId` | BigInt (unique) | Telegram user ID |
| `username` | String? | Telegram username |
| `firstName` | String? | Telegram first name |
| `userId` | String (unique) | System user ID (FK) |
| `createdAt` | DateTime | Creation timestamp |

**Relations**:
- `user` → User (cascade delete)

### TelegramLinkToken
Short-lived tokens for linking Telegram accounts.

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Primary key |
| `token` | String (unique) | Opaque hex token |
| `userId` | String | Target user ID |
| `expiresAt` | DateTime | Token expiration |
| `usedAt` | DateTime? | Usage timestamp |
| `createdAt` | DateTime | Creation timestamp |

**Indexes**: `token`, `userId`

### MemberTitleDefinition
System-admin-managed catalog of assignable titles.

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Primary key |
| `name` | String (unique) | Title name (e.g., "Başkan Yardımcısı") |
| `slug` | String (unique) | URL-friendly identifier |
| `description` | String? | Title description |
| `isActive` | Boolean | Active status (default: true) |
| `sortOrder` | Int | Display order (default: 0) |
| `createdAt` | DateTime | Creation timestamp |
| `updatedAt` | DateTime | Last update timestamp |

**Relations**:
- `memberships` → AssociationMembership[]

### Association
Tenant root - represents a dernek (association).

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Primary key |
| `name` | String | Association name |
| `shortName` | String? | Abbreviated name |
| `taxNumber` | String? (unique) | Tax identification number |
| `foundedAt` | DateTime | Founding date |
| `address` | String? | Address |
| `city` | String | City |
| `district` | String | District |
| `phone` | String? | Phone |
| `email` | String | Contact email |
| `website` | String? | Website URL |
| `logoUrl` | String? | Logo URL |
| `activityArea` | String | Activity area description |
| `memberCount` | Int | Member count (default: 0) |
| `isActive` | Boolean | Active status (default: true) |
| `notes` | String? | Internal notes |
| `createdById` | String | Creator user ID (FK) |
| `createdAt` | DateTime | Creation timestamp |
| `updatedAt` | DateTime | Last update timestamp |
| `deletedAt` | DateTime? | Soft delete timestamp |

**Indexes**: `city`, `isActive`, `createdById`, `deletedAt`

**Relations**:
- `createdBy` → User
- `memberships` → AssociationMembership[]
- `tasks` → Task[]
- `meetings` → MeetingNote[]
- `events` → Event[]
- `eventRoleDefinitions` → EventRoleDefinition[]
- `aiSuggestions` → AiSuggestion[]
- `transactionCategories` → TransactionCategory[]
- `transactions` → Transaction[]
- `financePermissions` → FinancePermission[]
- `meetingPermissions` → MeetingPermission[]
- `associationSettings` → AssociationSettings?

### AssociationMembership
Join table granting roles within an association.

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Primary key |
| `userId` | String | User ID (FK) |
| `associationId` | String | Association ID (FK) |
| `role` | UserRole | Role within association |
| `titleId` | String? | Title definition ID (FK) |
| `customTitle` | String? | Free-form title |
| `joinedAt` | DateTime | Join timestamp (default: now) |
| `leftAt` | DateTime? | Leave timestamp |
| `isActive` | Boolean | Active status (default: true) |
| `deletedAt` | DateTime? | Soft delete timestamp |

**Constraints**: `UNIQUE(userId, associationId, role)`

**Indexes**: `(associationId, role)`, `userId`, `deletedAt`

**Relations**:
- `user` → User
- `association` → Association
- `title` → MemberTitleDefinition?
- `eventAssignments` → EventAssignment[]

**Key Invariant**: One active başkan per association enforced by partial unique index `one_active_manager_per_association`.

### Task
Per-association task with assignment and tracking.

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Primary key |
| `associationId` | String | Association ID (FK) |
| `title` | String | Task title |
| `description` | String? | Task description |
| `assignedToUserId` | String | Assignee user ID (FK) |
| `assignedById` | String | Creator user ID (FK) |
| `watcherUserId` | String? | Watcher user ID (FK) |
| `status` | TaskStatus | Task status (default: PENDING) |
| `priority` | TaskPriority | Task priority (default: MEDIUM) |
| `dueDate` | DateTime? | Due date |
| `reminderAt` | DateTime? | Reminder time |
| `reminderFrequency` | ReminderFrequency | Reminder frequency (default: NONE) |
| `notifiedViaTelegram` | Boolean | Telegram notification sent (default: false) |
| `notifiedViaWhatsapp` | Boolean | WhatsApp notification sent (default: false) |
| `notifiedViaEmail` | Boolean | Email notification sent (default: false) |
| `lastNotifiedAt` | DateTime? | Last notification timestamp |
| `disputed` | Boolean | Dispute flag (default: false) |
| `disputedAt` | DateTime? | Dispute timestamp |
| `sourceMeetingNoteId` | String? | Source meeting note ID (FK) |
| `createdAt` | DateTime | Creation timestamp |
| `updatedAt` | DateTime | Last update timestamp |
| `completedAt` | DateTime? | Completion timestamp |
| `deletedAt` | DateTime? | Soft delete timestamp |

**Indexes**: `(associationId, status)`, `(assignedToUserId, status)`, `(assignedToUserId, associationId, status)`, `watcherUserId`, `dueDate`, `(associationId, disputed)`, `deletedAt`

**Relations**:
- `association` → Association (cascade delete)
- `assignedTo` → User (TaskAssignee)
- `assignedBy` → User (TaskCreator)
- `watcher` → User? (TaskWatcher, set null on delete)
- `sourceMeetingNote` → MeetingNote?
- `activities` → TaskActivity[]

**Precondition**: Assignee MUST have a TelegramAccount row.

### TaskActivity
Append-only audit trail for task state changes.

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Primary key |
| `taskId` | String | Task ID (FK) |
| `actorId` | String | Actor user ID (FK) |
| `action` | TaskActivityAction | Action type |
| `payload` | Json | Action data (default: "{}") |
| `createdAt` | DateTime | Creation timestamp |

**Indexes**: `(taskId, createdAt)`, `actorId`

**Relations**:
- `task` → Task (cascade delete)
- `actor` → User

**Design**: Read-only, never updated, never soft-deleted. Cascade deletes with parent task.

### MeetingNote
Per-association meeting records.

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Primary key |
| `associationId` | String | Association ID (FK) |
| `title` | String | Meeting title |
| `content` | String | Meeting content/notes |
| `meetingDate` | DateTime | Meeting date |
| `createdById` | String | Creator user ID (FK) |
| `createdAt` | DateTime | Creation timestamp |
| `updatedAt` | DateTime | Last update timestamp |
| `deletedAt` | DateTime? | Soft delete timestamp |

**Indexes**: `(associationId, meetingDate)`, `deletedAt`

**Relations**:
- `association` → Association (cascade delete)
- `createdBy` → User
- `attendees` → MeetingAttendee[]
- `derivedTasks` → Task[] (planned feature)

### MeetingAttendee
Many-to-many join for meeting attendees.

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Primary key |
| `meetingNoteId` | String | Meeting ID (FK) |
| `userId` | String | User ID (FK) |

**Constraints**: `UNIQUE(meetingNoteId, userId)`

**Indexes**: `userId`

**Relations**:
- `meetingNote` → MeetingNote (cascade delete)
- `user` → User

### EventRoleDefinition
Per-association catalog of event responsibilities.

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Primary key |
| `associationId` | String | Association ID (FK) |
| `name` | String | Role name (e.g., "Ses Sistemi") |
| `description` | String? | Role description |
| `sortOrder` | Int | Display order (default: 0) |
| `createdAt` | DateTime | Creation timestamp |
| `updatedAt` | DateTime | Last update timestamp |
| `deletedAt` | DateTime? | Soft delete timestamp |

**Constraints**: `UNIQUE(associationId, name)`

**Indexes**: `(associationId, deletedAt)`

**Relations**:
- `association` → Association (cascade delete)
- `assignments` → EventAssignment[]

### Event
Association events with recurrence support.

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Primary key |
| `associationId` | String | Association ID (FK) |
| `title` | String | Event title |
| `description` | String? | Event description |
| `type` | EventType | Event type (default: CUSTOM) |
| `location` | String? | Event location |
| `startsAt` | DateTime | Start time |
| `endsAt` | DateTime? | End time |
| `notifyAt` | DateTime | Notification trigger time |
| `recurrenceType` | RecurrenceType | Recurrence pattern (default: NONE) |
| `recurrenceInterval` | Int | Recurrence interval (default: 1) |
| `recurrenceEndsAt` | DateTime? | Recurrence end time |
| `notificationSent` | Boolean | Notification sent flag (default: false) |
| `createdById` | String | Creator user ID (FK) |
| `expenseAmount` | Int? | Associated expense |
| `expenseNote` | String? | Expense note |
| `createdAt` | DateTime | Creation timestamp |
| `updatedAt` | DateTime | Last update timestamp |
| `deletedAt` | DateTime? | Soft delete timestamp |

**Indexes**: `(associationId, startsAt)`, `(associationId, deletedAt)`, `notifyAt`

**Relations**:
- `association` → Association (cascade delete)
- `createdBy` → User
- `assignments` → EventAssignment[]
- `programItems` → EventProgramItem[]
- `transactions` → Transaction[]

### EventAssignment
Member-to-event-role assignments.

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Primary key |
| `eventId` | String | Event ID (FK) |
| `membershipId` | String | Membership ID (FK) |
| `roleDefinitionId` | String? | Role definition ID (FK) |
| `customRole` | String? | Free-form role name |
| `notes` | String? | Assignment notes |
| `notificationSent` | Boolean | Notification sent flag (default: false) |
| `notifiedAt` | DateTime? | Notification timestamp |
| `createdAt` | DateTime | Creation timestamp |
| `updatedAt` | DateTime | Last update timestamp |

**Indexes**: `eventId`, `membershipId`, `roleDefinitionId`

**Relations**:
- `event` → Event (cascade delete)
- `membership` → AssociationMembership
- `roleDefinition` → EventRoleDefinition?

**Design**: Role is either catalog reference (roleDefinitionId) or custom string.

### ExternalEvent
Cached events from municipal websites.

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Primary key |
| `source` | String | Source identifier (e.g., "gebze_belediyesi") |
| `externalId` | String | Original source ID |
| `title` | String | Event title |
| `category` | String | Event category |
| `location` | String | Event location |
| `eventDate` | DateTime | Event date |
| `eventTime` | String? | Event time |
| `description` | String? | Event description |
| `detailUrl` | String | Source URL |
| `imageUrl` | String? | Image URL |
| `createdAt` | DateTime | Creation timestamp |
| `updatedAt` | DateTime | Last update timestamp |

**Constraints**: `UNIQUE(source, externalId)`

**Indexes**: `(source, eventDate)`

### AiSuggestion
AI-generated Islamic event suggestions.

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Primary key |
| `associationId` | String | Association ID (FK) |
| `period` | String | Suggestion period (weekly/monthly) |
| `targetAudience` | String | Target audience (all/middle_school/high_school) |
| `title` | String | Suggestion title |
| `description` | String (Text) | Detailed description |
| `category` | String | Category (sohbet/egitim/kultur/genclik/aile/sosyal_sorumluluk/ibadet) |
| `keyTopics` | String[] | Key topics array |
| `resourcesNeeded` | String | Required resources |
| `estimatedParticipants` | String | Expected participant count |
| `islamicSession` | Json? | Islamic session data |
| `schedule` | Json? | Schedule data |
| `socialContent` | Json? | Social media content |
| `metadata` | Json? | Generation metadata (temperature, perspective, fewShotCount, promptVersion) |
| `createdById` | String | Creator user ID (FK) |
| `createdAt` | DateTime | Creation timestamp |

**Indexes**: `(associationId, createdAt)`

**Relations**:
- `association` → Association (cascade delete)
- `createdBy` → User
- `feedback` → AiSuggestionFeedback?
- `savedBy` → SavedSuggestion[]

### AiSuggestionFeedback
Feedback on AI suggestions for learning.

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Primary key |
| `suggestionId` | String (unique) | Suggestion ID (FK) |
| `rating` | Int | Rating score |
| `isHelpful` | Boolean? | Helpfulness flag |
| `comment` | String? | Feedback comment |
| `likedCategories` | String[] | Liked categories |
| `dislikedCategories` | String[] | Disliked categories |
| `createdAt` | DateTime | Creation timestamp |

**Relations**:
- `suggestion` → AiSuggestion (cascade delete)

### PromptTemplate
Versioned prompt templates for A/B testing.

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Primary key |
| `key` | String | Template key (e.g., "suggest-islamic-events") |
| `version` | Int | Version number (default: 1) |
| `content` | String (Text) | Prompt content |
| `isActive` | Boolean | Active status (default: true) |
| `createdAt` | DateTime | Creation timestamp |
| `updatedAt` | DateTime | Last update timestamp |

**Constraints**: `UNIQUE(key, version)`

**Indexes**: `(key, isActive)`

### SavedSuggestion
User-saved suggestions for later use.

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Primary key |
| `userId` | String | User ID (FK) |
| `suggestionId` | String | Suggestion ID (FK) |
| `note` | String? | User note |
| `createdAt` | DateTime | Creation timestamp |

**Constraints**: `UNIQUE(userId, suggestionId)`

**Indexes**: `userId`, `suggestionId`

**Relations**:
- `user` → User (cascade delete)
- `suggestion` → AiSuggestion (cascade delete)

### EventProgramItem
Structured program items for events (agenda/schedule).

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Primary key |
| `eventId` | String | Event ID (FK) |
| `startTime` | String | Start time (e.g., "14:00") |
| `duration` | String | Duration (e.g., "30 dk") |
| `title` | String | Item title |
| `description` | String? | Item description |
| `order` | Int | Display order (default: 0) |

**Indexes**: `eventId`

**Relations**:
- `event` → Event (cascade delete)

### TransactionCategory
Categories for financial transactions.

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Primary key |
| `associationId` | String | Association ID (FK) |
| `name` | String | Category name |
| `type` | TransactionType | Income or expense |
| `sortOrder` | Int | Display order (default: 0) |
| `isActive` | Boolean | Active status (default: true) |
| `createdAt` | DateTime | Creation timestamp |
| `updatedAt` | DateTime | Last update timestamp |
| `deletedAt` | DateTime? | Soft delete timestamp |

**Constraints**: `UNIQUE(associationId, name)`

**Indexes**: `(associationId, type, deletedAt)`

**Relations**:
- `association` → Association (cascade delete)
- `transactions` → Transaction[]

### Transaction
Financial transactions (income/expense).

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Primary key |
| `associationId` | String | Association ID (FK) |
| `categoryId` | String | Category ID (FK) |
| `eventId` | String? | Related event ID (FK) |
| `type` | TransactionType | Income or expense |
| `amountInKurus` | Int | Amount in kuruş (cents) |
| `description` | String? | Transaction description |
| `receiptUrl` | String? | Receipt image URL |
| `transactionDate` | DateTime | Transaction date (default: now) |
| `createdById` | String | Creator user ID (FK) |
| `createdAt` | DateTime | Creation timestamp |
| `updatedAt` | DateTime | Last update timestamp |
| `deletedAt` | DateTime? | Soft delete timestamp |

**Indexes**: `(associationId, transactionDate)`, `(associationId, type, deletedAt)`, `eventId`

**Relations**:
- `association` → Association (cascade delete)
- `category` → TransactionCategory
- `event` → Event?
- `createdBy` → User

### FinancePermission
Grants finance access to users within an association.

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Primary key |
| `associationId` | String | Association ID (FK) |
| `userId` | String | User ID (FK) |
| `grantedById` | String | Granter user ID (FK) |
| `grantedAt` | DateTime | Grant timestamp (default: now) |
| `revokedAt` | DateTime? | Revocation timestamp |
| `isActive` | Boolean | Active status (default: true) |

**Constraints**: `UNIQUE(associationId, userId)`

**Indexes**: `(associationId, isActive)`

**Relations**:
- `association` → Association (cascade delete)
- `user` → User (FinancePermissionUser)
- `grantedBy` → User (FinancePermissionGranter)

### MeetingPermission
Grants meeting management access to users.

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Primary key |
| `associationId` | String | Association ID (FK) |
| `userId` | String | User ID (FK) |
| `grantedById` | String | Granter user ID (FK) |
| `grantedAt` | DateTime | Grant timestamp (default: now) |
| `revokedAt` | DateTime? | Revocation timestamp |
| `isActive` | Boolean | Active status (default: true) |

**Constraints**: `UNIQUE(associationId, userId)`

**Indexes**: `(associationId, isActive)`

**Relations**:
- `association` → Association (cascade delete)
- `user` → User (MeetingPermissionUser)
- `grantedBy` → User (MeetingPermissionGranter)

### AssociationSettings
Per-association configuration settings.

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Primary key |
| `associationId` | String (unique) | Association ID (FK) |
| `monthlyFeeAmountKurus` | Int? | Monthly fee in kuruş |
| `yearlyFeeAmountKurus` | Int? | Yearly fee in kuruş |
| `feeFrequency` | String | Fee frequency (default: "MONTHLY") |
| `createdAt` | DateTime | Creation timestamp |
| `updatedAt` | DateTime | Last update timestamp |

**Relations**:
- `association` → Association (cascade delete)

## Key Design Patterns

### Soft Delete
Models with `deletedAt` field:
- `Association`
- `AssociationMembership`
- `Task`
- `MeetingNote`
- `Event`
- `EventRoleDefinition`
- `TransactionCategory`
- `Transaction`

**Rule**: ALL queries on these models MUST include `deletedAt: null`.

### Multi-Tenancy
All tenant-scoped models carry `associationId`:
- `AssociationMembership`
- `Task`
- `MeetingNote`
- `Event`
- `EventRoleDefinition`
- `EventAssignment`
- `AiSuggestion`
- `TransactionCategory`
- `Transaction`
- `FinancePermission`
- `MeetingPermission`
- `AssociationSettings`

### Cascade Deletes
- `Association` deletion cascades to all tenant-scoped models
- `Task` deletion cascades to `TaskActivity`
- `MeetingNote` deletion cascades to `MeetingAttendee`
- `Event` deletion cascades to `EventAssignment` and `EventProgramItem`

### Partial Unique Index
`one_active_manager_per_association` on `AssociationMembership`:
- Ensures only one active `ASSOCIATION_MANAGER` per association
- Uses `WHERE "isActive" = true AND "deletedAt" IS NULL AND role = 'ASSOCIATION_MANAGER'`

## Stubbed Fields (Not Yet Wired)

### Task Notification Fields
- `notifiedViaTelegram`
- `notifiedViaWhatsapp`
- `notifiedViaEmail`
- `lastNotifiedAt`
- `reminderAt`
- `reminderFrequency`

These are reserved for the upcoming notification system. Columns exist but no writer/scheduler is implemented.

### Meeting-to-Task Extraction
- `Task.sourceMeetingNoteId` - Reserved for spawning action items from meeting notes
- `MeetingNote.derivedTasks` - Back-relation to tasks
- AI plumbing exists (`@ticketbot/ai`) but extraction flow is not implemented

## Database Migrations

Migrations are stored in `libs/database/prisma/migrations/`.

Key migrations:
- `20260424080804_add_one_active_manager_partial_index` - Adds the partial unique index for one active manager per association

## Prisma Configuration

```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "debian-openssl-3.0.x"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

## Database Commands

```bash
pnpm db:generate      # Generate Prisma client
pnpm db:migrate       # Run migrations (dev)
pnpm db:migrate:deploy # Run migrations (production)
pnpm db:seed          # Seed database
pnpm db:studio        # Open Prisma Studio
pnpm db:dev-reset     # Reset development database
```
