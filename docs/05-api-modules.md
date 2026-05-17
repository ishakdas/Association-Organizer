# API Modules

## Overview

The API server contains 16+ feature modules organized under `apps/api/src/modules/`. Each module follows a consistent pattern with controllers, services, and DTOs.

## Module Registration

All modules are registered in `AppModule` (`apps/api/src/app.module.ts`):

```typescript
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    PrismaModule,
    SupabaseModule,
    AuthModule,
    AssociationsModule,
    TitlesModule,
    UsersModule,
    JobsModule,
    TasksModule,
    MeetingsModule,
    EventsModule,
    EventRolesModule,
    IslamicCalendarModule,
    AiHelperModule,
    FinanceModule,
    AdminModule,
    EmailModule,
    HealthModule,
    BotModule,
  ],
})
export class AppModule {}
```

## Module Patterns

### Association-Scoped Module Pattern

Reference: `apps/api/src/modules/tasks/`

```
modules/tasks/
├── tasks.module.ts
├── tasks.controller.ts
├── tasks.service.ts
├── dto/
│   ├── create-task.dto.ts
│   └── update-task.dto.ts
└── index.ts
```

**Structure**:
1. **Module**: Imports `PrismaModule`, provides controller + service
2. **Controller**: 
   - Route: `@Controller('associations/:associationId/x')`
   - Guards: `@UseGuards(AuthGuard, SupabaseUserGuard, AssociationRolesGuard)`
   - Validation: `@UsePipes(ZodValidationPipe)`
   - Every handler decorated with `@AssociationRoles(...)`
3. **Service**: All queries filtered by `associationId` AND `deletedAt: null`

### System-Scoped Module Pattern

Reference: `apps/api/src/modules/associations/` (create/list endpoints)

```
modules/associations/
├── associations.module.ts
├── associations.controller.ts
├── associations.service.ts
└── dto/
```

**Structure**:
1. **Module**: Imports `PrismaModule`, provides controller + service
2. **Controller**:
   - Route: `@Controller('x')`
   - Guards: `@UseGuards(AuthGuard, SupabaseUserGuard, RolesGuard)`
   - Validation: `@UsePipes(ZodValidationPipe)`
   - Every handler decorated with `@Roles(...)`
3. **Service**: System-level queries

## Module Details

### 1. Auth Module

**Path**: `modules/auth/`

**Purpose**: Token issuance, Telegram link tokens, user profile retrieval.

**Endpoints**:
| Method | Route | Guard | Description |
|--------|-------|-------|-------------|
| GET | `/auth/me` | AuthGuard | Get current user profile |
| POST | `/auth/link-token` | AuthGuard | Generate Telegram link token |
| POST | `/auth/redeem-link` | None | Redeem link token (bot) |

**Key Services**:
- `AuthService.issueBotToken()` - Issues bot JWT after link redemption
- `AuthService.generateLinkToken()` - Creates short-lived link token
- `AuthService.redeemLinkToken()` - Validates token, creates TelegramAccount, issues JWT

### 2. Users Module

**Path**: `modules/users/`

**Purpose**: User provisioning (Supabase + DB-only paths).

**Endpoints**:
| Method | Route | Guard | Description |
|--------|-------|-------|-------------|
| POST | `/users` | Roles(SYSTEM_ADMIN) | Create user (provisioning saga) |
| GET | `/users/:id` | Roles(SYSTEM_ADMIN) | Get user by ID |
| PATCH | `/users/:id` | Roles(SYSTEM_ADMIN) | Update user |
| DELETE | `/users/:id` | Roles(SYSTEM_ADMIN) | Soft delete user |

**Key Services**:
- `UsersService.createWithSupabase()` - Two-step saga with rollback
- `UsersService.createDbOnly()` - DB-only user creation

**Provisioning Saga Pattern**:
```typescript
async createWithSupabase(data: CreateUserDto) {
  // 1. Create Supabase user
  const supabaseUser = await this.supabaseAdmin.createUser({
    email: data.email,
    password: data.password,
  });

  try {
    // 2. Create Prisma user (atomic)
    return await this.prisma.$transaction([
      this.prisma.user.create({
        data: {
          supabaseUserId: supabaseUser.id,
          email: data.email,
          fullName: data.fullName,
        }
      })
    ]);
  } catch (error) {
    // 3. Rollback: Delete orphaned Supabase user
    await this.supabaseAdmin.deleteUser(supabaseUser.id);
    throw error;
  }
}
```

### 3. Associations Module

**Path**: `modules/associations/`

**Purpose**: Association CRUD, membership management, member-title assignment.

**Endpoints**:
| Method | Route | Guard | Description |
|--------|-------|-------|-------------|
| POST | `/associations` | Roles(SYSTEM_ADMIN) | Create association |
| GET | `/associations` | Roles(SYSTEM_ADMIN) | List all associations |
| GET | `/associations/:id` | AssociationRoles(...) | Get association details |
| PATCH | `/associations/:id` | AssociationRoles(MANAGER) | Update association |
| DELETE | `/associations/:id` | AssociationRoles(MANAGER) | Soft delete association |
| GET | `/associations/:id/members` | AssociationRoles(...) | List members |
| POST | `/associations/:id/members` | AssociationRoles(MANAGER, SECRETARY) | Add member |
| PATCH | `/associations/:id/members/:memberId` | AssociationRoles(MANAGER, SECRETARY) | Update membership |
| DELETE | `/associations/:id/members/:memberId` | AssociationRoles(MANAGER, SECRETARY) | Remove member |

**Key Services**:
- `AssociationsService.create()` - Creates association with creator as MANAGER
- `AssociationsService.addMember()` - Adds membership with role validation
- `AssociationsService.removeMember()` - Soft deletes membership

**Business Rules**:
- One active MANAGER per association (enforced by partial unique index)
- Creator becomes initial MANAGER
- Members can have titles (titleId) or custom titles

### 4. Tasks Module

**Path**: `modules/tasks/`

**Purpose**: Per-association task board with assignment and tracking.

**Endpoints**:
| Method | Route | Guard | Description |
|--------|-------|-------|-------------|
| GET | `/associations/:associationId/tasks` | AssociationRoles(...) | List tasks |
| GET | `/associations/:associationId/tasks/:id` | AssociationRoles(...) | Get task details |
| POST | `/associations/:associationId/tasks` | AssociationRoles(MANAGER, SECRETARY) | Create task |
| PATCH | `/associations/:associationId/tasks/:id` | AssociationRoles(...) | Update task |
| DELETE | `/associations/:associationId/tasks/:id` | AssociationRoles(MANAGER, SECRETARY) | Soft delete task |
| POST | `/associations/:associationId/tasks/:id/dispute` | AssociationRoles(MEMBER) | Dispute task |
| POST | `/associations/:associationId/tasks/:id/resolve-dispute` | AssociationRoles(MANAGER, SECRETARY) | Resolve dispute |

**Key Services**:
- `TasksService.create()` - Validates assignee has TelegramAccount
- `TasksService.update()` - Creates TaskActivity for each change
- `TasksService.dispute()` - Flags task for manager review

**Business Rules**:
- Assignee MUST have TelegramAccount (validated on creation)
- All status/priority changes logged in TaskActivity
- Members can dispute wrongly assigned tasks
- Only MANAGER/SECRETARY can resolve disputes

### 5. Meetings Module

**Path**: `modules/meetings/`

**Purpose**: Meeting notes with attendee tracking.

**Endpoints**:
| Method | Route | Guard | Description |
|--------|-------|-------|-------------|
| GET | `/associations/:associationId/meetings` | AssociationRoles(...) | List meetings |
| GET | `/associations/:associationId/meetings/:id` | AssociationRoles(...) | Get meeting details |
| POST | `/associations/:associationId/meetings` | AssociationRoles(MANAGER, SECRETARY) | Create meeting |
| PATCH | `/associations/:associationId/meetings/:id` | AssociationRoles(MANAGER, SECRETARY) | Update meeting |
| DELETE | `/associations/:associationId/meetings/:id` | AssociationRoles(MANAGER, SECRETARY) | Soft delete meeting |
| POST | `/associations/:associationId/meetings/:id/attendees` | AssociationRoles(MANAGER, SECRETARY) | Add attendees |

**Key Services**:
- `MeetingsService.create()` - Creates meeting with attendees
- `MeetingsService.addAttendees()` - Adds MeetingAttendee rows

**Business Rules**:
- Only MANAGER/SECRETARY can create meetings
- All members can view meetings
- Attendees tracked via MeetingAttendee join table

### 6. Events Module

**Path**: `modules/events/`

**Purpose**: Event management with recurrence and notifications.

**Endpoints**:
| Method | Route | Guard | Description |
|--------|-------|-------|-------------|
| GET | `/associations/:associationId/events` | AssociationRoles(...) | List events |
| GET | `/associations/:associationId/events/:id` | AssociationRoles(...) | Get event details |
| POST | `/associations/:associationId/events` | AssociationRoles(MANAGER, SECRETARY) | Create event |
| PATCH | `/associations/:associationId/events/:id` | AssociationRoles(MANAGER, SECRETARY) | Update event |
| DELETE | `/associations/:associationId/events/:id` | AssociationRoles(MANAGER, SECRETARY) | Soft delete event |
| POST | `/associations/:associationId/events/:id/assignments` | AssociationRoles(MANAGER, SECRETARY) | Assign members |
| DELETE | `/associations/:associationId/events/:id/assignments/:assignmentId` | AssociationRoles(MANAGER, SECRETARY) | Remove assignment |
| GET | `/associations/:associationId/events/:id/program` | AssociationRoles(...) | Get program items |
| POST | `/associations/:associationId/events/:id/program` | AssociationRoles(MANAGER, SECRETARY) | Add program items |

**Key Services**:
- `EventsService.create()` - Creates event with notifyAt scheduling
- `EventsService.assignMembers()` - Creates EventAssignment rows
- `EventsService.getUpcoming()` - Returns events due for notification

**Business Rules**:
- Events can recur (daily, weekly, monthly)
- `notifyAt` determines when bot should DM assignees
- `notificationSent` flag prevents duplicate notifications
- Recurring events reset `notificationSent` on each occurrence

### 7. Event Roles Module

**Path**: `modules/event-roles/`

**Purpose**: Per-association event role definitions.

**Endpoints**:
| Method | Route | Guard | Description |
|--------|-------|-------|-------------|
| GET | `/associations/:associationId/event-roles` | AssociationRoles(...) | List role definitions |
| POST | `/associations/:associationId/event-roles` | AssociationRoles(MANAGER, SECRETARY) | Create role definition |
| PATCH | `/associations/:associationId/event-roles/:id` | AssociationRoles(MANAGER, SECRETARY) | Update role definition |
| DELETE | `/associations/:associationId/event-roles/:id` | AssociationRoles(MANAGER, SECRETARY) | Soft delete role definition |

**Key Services**:
- `EventRolesService.create()` - Creates role definition (e.g., "Ses Sistemi")
- `EventRolesService.findAll()` - Returns association-specific roles

**Business Rules**:
- Each association curates its own role catalog
- Separate from MemberTitleDefinition (system-wide)
- Unique constraint on `(associationId, name)`

### 8. Finance Module

**Path**: `modules/finance/`

**Purpose**: Financial tracking (income/expense).

**Endpoints**:
| Method | Route | Guard | Description |
|--------|-------|-------|-------|-------------|
| GET | `/associations/:associationId/finance/transactions` | AssociationRoles(...) | List transactions |
| GET | `/associations/:associationId/finance/transactions/:id` | AssociationRoles(...) | Get transaction |
| POST | `/associations/:associationId/finance/transactions` | AssociationRoles(MANAGER, SECRETARY) | Create transaction |
| PATCH | `/associations/:associationId/finance/transactions/:id` | AssociationRoles(MANAGER, SECRETARY) | Update transaction |
| DELETE | `/associations/:associationId/finance/transactions/:id` | AssociationRoles(MANAGER, SECRETARY) | Soft delete transaction |
| GET | `/associations/:associationId/finance/categories` | AssociationRoles(...) | List categories |
| POST | `/associations/:associationId/finance/categories` | AssociationRoles(MANAGER, SECRETARY) | Create category |

**Key Services**:
- `FinanceService.createTransaction()` - Creates transaction with category
- `FinanceService.getBalance()` - Calculates income - expense

**Business Rules**:
- Amounts stored in kuruş (cents)
- Transactions can link to events
- Receipt URLs supported
- Finance permissions system (schema exists, implementation partial)

### 9. Titles Module

**Path**: `modules/titles/`

**Purpose**: System-admin-managed title catalog.

**Endpoints**:
| Method | Route | Guard | Description |
|--------|-------|-------|-------------|
| GET | `/titles` | Roles(SYSTEM_ADMIN) | List all titles |
| POST | `/titles` | Roles(SYSTEM_ADMIN) | Create title |
| PATCH | `/titles/:id` | Roles(SYSTEM_ADMIN) | Update title |
| DELETE | `/titles/:id` | Roles(SYSTEM_ADMIN) | Delete title |

**Key Services**:
- `TitlesService.create()` - Creates MemberTitleDefinition
- `TitlesService.findAll()` - Returns active titles

**Business Rules**:
- Only SYSTEM_ADMIN can manage titles
- Titles are system-wide (not per-association)
- Used by associations when assigning member titles

### 10. AI Helper Module

**Path**: `modules/ai-helper/`

**Purpose**: AI-powered Islamic event suggestions.

**Endpoints**:
| Method | Route | Guard | Description |
|--------|-------|-------|-------------|
| POST | `/associations/:associationId/ai/suggest` | AssociationRoles(MANAGER, SECRETARY) | Generate AI suggestion |
| GET | `/associations/:associationId/ai/suggestions` | AssociationRoles(...) | List suggestions |
| GET | `/associations/:associationId/ai/suggestions/:id` | AssociationRoles(...) | Get suggestion |
| POST | `/associations/:associationId/ai/suggestions/:id/feedback` | AssociationRoles(...) | Submit feedback |
| POST | `/associations/:associationId/ai/suggestions/:id/save` | AssociationRoles(...) | Save suggestion |

**Key Services**:
- `AiHelperService.generateSuggestion()` - Calls OpenAI with prompt template
- `AiHelperService.submitFeedback()` - Records feedback for learning
- `AiHelperService.saveSuggestion()` - Creates SavedSuggestion row

**Business Rules**:
- Suggestions categorized (sohbet, egitim, kultur, genclik, aile, etc.)
- Target audience filtering (all, middle_school, high_school)
- Feedback system for A/B testing and learning
- Prompt templates versioned for experimentation

### 11. Islamic Calendar Module

**Path**: `modules/islamic-calendar/`

**Purpose**: Islamic date calculations and religious events.

**Endpoints**:
| Method | Route | Guard | Description |
|--------|-------|-------|-------------|
| GET | `/islamic-calendar/dates` | None | Get Islamic calendar dates |
| GET | `/islamic-calendar/events` | None | Get upcoming Islamic events |

**Key Services**:
- `IslamicCalendarService.getKandilDates()` - Returns Kandil dates for year
- `IslamicCalendarService.getIslamicDate()` - Converts Gregorian to Islamic date

**Business Rules**:
- Used by AI suggestion system for event timing
- Kandil, Ramadan, Eid dates calculated
- External events may reference Islamic calendar

### 12. Admin Module

**Path**: `modules/admin/`

**Purpose**: System administration features.

**Endpoints**:
| Method | Route | Guard | Description |
|--------|-------|-------|-------------|
| GET | `/admin/users` | Roles(SYSTEM_ADMIN) | List all users |
| GET | `/admin/pending-branches` | Roles(SYSTEM_ADMIN) | List pending branch registrations |
| PATCH | `/admin/pending-branches/:id` | Roles(SYSTEM_ADMIN) | Review branch registration |
| GET | `/admin/ai-suggestions` | Roles(SYSTEM_ADMIN) | Manage AI suggestions |

**Key Services**:
- `AdminService.getPendingBranches()` - Returns pending registrations
- `AdminService.reviewBranch()` - Approves/rejects registration

### 13. Email Module

**Path**: `modules/email/`

**Purpose**: Email service (stubbed).

**Key Services**:
- `EmailService.send()` - Sends email (implementation pending)
- Used for future notification system

### 14. Jobs Module

**Path**: `modules/jobs/`

**Purpose**: BullMQ queue system (stubbed).

**Key Services**:
- `JobsService.queueNotification()` - Queues notification job (stubbed)
- `JobsService.processReminders()` - Processes task reminders (stubbed)

**Future Use**:
- Task reminder scheduler
- Event notification dispatcher
- Meeting-to-task extraction

### 15. Supabase Module

**Path**: `modules/supabase/`

**Purpose**: Admin Supabase client for provisioning.

**Key Services**:
- `SupabaseService.getAdminClient()` - Returns service-role client
- Used by UsersModule for user provisioning

**Security**: Service role key is backend-only, never exposed to web.

### 16. Health Module

**Path**: `modules/health/`

**Purpose**: Health check endpoints.

**Endpoints**:
| Method | Route | Guard | Description |
|--------|-------|-------|-------------|
| GET | `/health` | None | Basic health check |
| GET | `/health/ready` | None | Readiness probe |
| GET | `/health/alive` | None | Liveness probe |

### 17. Bot Module

**Path**: `modules/bot/` (imported from `apps/bot`)

**Purpose**: Telegram bot integration.

**Webhook**: `/telegram/webhook` (outside `api/v1` prefix)

**Key Services**:
- `BotService.handleUpdate()` - Processes Telegram updates
- `BotService.sendNotification()` - Sends Telegram message

## Common Patterns

### Validation

All controllers use `ZodValidationPipe` per-controller:

```typescript
@Controller('associations/:associationId/tasks')
@UsePipes(ZodValidationPipe)
export class TasksController {
  // DTOs use createZodDto pattern
}
```

DTOs define Zod schemas:

```typescript
export class CreateTaskDto {
  static schema = z.object({
    title: z.string().min(1).max(200),
    description: z.string().optional(),
    assignedToUserId: z.string(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
    dueDate: z.string().datetime().optional(),
  });
}
```

### Error Handling

Global `HttpExceptionFilter` formats errors as RFC 7807 Problem Details:

```json
{
  "type": "https://example.com/errors/not-found",
  "title": "Not Found",
  "status": 404,
  "detail": "Task not found",
  "instance": "/api/v1/associations/123/tasks/456"
}
```

### Soft Delete

All tenant-scoped queries filter by `deletedAt: null`:

```typescript
// Correct pattern
prisma.task.findMany({
  where: {
    associationId,
    deletedAt: null,
    // ... other filters
  }
});
```

### Activity Logging

Task changes logged via TaskActivity:

```typescript
async update(id: string, data: UpdateTaskDto, actorId: string) {
  const task = await this.prisma.task.update({
    where: { id },
    data: { ...data, updatedAt: new Date() }
  });

  // Log activity
  await this.prisma.taskActivity.create({
    data: {
      taskId: id,
      actorId,
      action: TaskActivityAction.STATUS_CHANGED,
      payload: { from: oldStatus, to: data.status }
    }
  });

  return task;
}
```

## Module Dependencies

```
AppModule
├── PrismaModule (database)
├── SupabaseModule (admin client)
├── AuthModule
│   └── Used by all modules for authentication
├── AssociationsModule
│   └── Used by all association-scoped modules
├── UsersModule
│   └── Used by AuthModule for provisioning
├── TasksModule
│   └── Depends on AssociationsModule
├── MeetingsModule
│   └── Depends on AssociationsModule
├── EventsModule
│   └── Depends on AssociationsModule
├── EventRolesModule
│   └── Depends on EventsModule
├── FinanceModule
│   └── Depends on AssociationsModule
├── AiHelperModule
│   └── Depends on @ticketbot/ai
├── IslamicCalendarModule
│   └── Used by AiHelperModule
├── TitlesModule
│   └── Used by AssociationsModule
├── AdminModule
│   └── System administration
├── EmailModule
│   └── Future notifications
├── JobsModule
│   └── Future async jobs
├── HealthModule
│   └── Health checks
└── BotModule
    └── Telegram integration
```

## Adding New Modules

### Association-Scoped Module

1. Create module directory: `modules/x/`
2. Create `x.module.ts`:
   ```typescript
   @Module({
     imports: [PrismaModule],
     controllers: [XController],
     providers: [XService],
     exports: [XService],
   })
   export class XModule {}
   ```
3. Create `x.controller.ts`:
   ```typescript
   @Controller('associations/:associationId/x')
   @UseGuards(AuthGuard, SupabaseUserGuard, AssociationRolesGuard)
   @UsePipes(ZodValidationPipe)
   export class XController {
     @Get()
     @AssociationRoles(UserRole.ASSOCIATION_MANAGER, UserRole.ASSOCIATION_SECRETARY)
     findAll() { ... }
   }
   ```
4. Create `x.service.ts`:
   ```typescript
   export class XService {
     findAll(associationId: string) {
       return this.prisma.x.findMany({
         where: { associationId, deletedAt: null }
       });
     }
   }
   ```
5. Add Zod schemas to `libs/shared-validation/src/schemas/`
6. Add DTOs to `libs/shared-types/src/domain/`
7. Register in `AppModule`

### System-Scoped Module

Same pattern but:
- Controller route: `@Controller('x')`
- Guards: `@UseGuards(AuthGuard, SupabaseUserGuard, RolesGuard)`
- Decorators: `@Roles(...)` instead of `@AssociationRoles(...)`
