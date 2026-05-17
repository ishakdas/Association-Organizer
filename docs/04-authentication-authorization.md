# Authentication & Authorization

## Overview

The system implements a dual-mode authentication system that supports both web users (via Supabase JWT) and Telegram bot users (via custom bot JWT). Authorization is handled through two separate role guards that enforce system-level and association-level permissions.

## Authentication Flow

### Token Types

The system handles two types of JWT tokens, distinguished by their signing secrets:

| Token Type | Signing Secret | Used By | Purpose |
|------------|----------------|---------|---------|
| Supabase JWT | `SUPABASE_JWT_SECRET` | Web App | Web user authentication |
| Bot JWT | `JWT_SECRET` | Telegram Bot | Bot user authentication |

Both tokens use `HS256` algorithm. The `AuthGuard` distinguishes between them by inspecting the JWT `alg` header.

### AuthGuard Implementation

Location: `apps/api/src/common/guards/auth.guard.ts`

**Token Detection Logic**:
1. Extract JWT from `Authorization: Bearer <token>` header
2. Decode token header to read `alg` field
3. Determine token type:
   - If signed with `SUPABASE_JWT_SECRET` → Supabase JWT
   - If signed with `JWT_SECRET` → Bot JWT
4. Validate token with appropriate secret
5. Resolve to `User` row:
   - Supabase JWT: Match via `User.supabaseUserId`
   - Bot JWT: Extract `userId` claim directly
6. Attach `AuthenticatedUser` to `request.user`

### AuthenticatedUser Shape

```typescript
interface AuthenticatedUser {
  id: string;
  email: string | null;
  systemRole: UserRole;
  memberships: AuthMembership[];
}

interface AuthMembership {
  associationId: string;
  role: UserRole;
  titleId: string | null;
  customTitle: string | null;
}
```

**Key Design**: Active memberships are eager-loaded onto `request.user` by `AuthGuard`, so authorization guards can check permissions without extra database queries.

## User Provisioning

### Supabase User Flow

When a user authenticates via Supabase (web login):

```
1. User logs in via Supabase Auth (web)
2. Supabase issues JWT
3. User makes API request with JWT
4. AuthGuard validates JWT
5. SupabaseUserGuard checks if User row exists
6. If not exists → Provisioning saga triggered
```

### Provisioning Saga

Location: `apps/api/src/modules/users/users.service.ts`

**Two-Step Atomic Process**:

```typescript
// Step 1: Create Supabase auth user
const supabaseUser = await supabaseAdmin.createUser({
  email,
  password,
  // ... other fields
});

// Step 2: Create Prisma User row (atomic with rollback)
try {
  await prisma.$transaction([
    prisma.user.create({
      data: {
        supabaseUserId: supabaseUser.id,
        email,
        fullName,
        // ... other fields
      }
    }),
    // Optionally create AssociationMembership
  ]);
} catch (error) {
  // Rollback: Delete orphaned Supabase user
  await supabaseAdmin.deleteUser(supabaseUser.id);
  throw error;
}
```

**Critical**: The rollback catch MUST NOT silently swallow errors. Failing to delete the orphaned Supabase user leaves inconsistent state.

### DB-Only Users

Users created without Supabase auth have:
- `supabaseUserId: null`
- `email` may be null
- Cannot access web interface
- Can only interact via Telegram bot

## Telegram Link-Token Flow

The bot linking flow connects a system User to a Telegram account.

### Flow Steps

```
1. User (web or admin) generates link token
   → AuthService.generateLinkToken()
   → Creates TelegramLinkToken row with short-lived hex token

2. User opens Telegram bot and sends /link command
   → Bot prompts for token

3. User provides token
   → Bot calls AuthService.redeemLinkToken(token)
   → Validates token (exists, not expired, not used)
   → Creates TelegramAccount row
   → Issues 30-day bot JWT
   → Marks token as used

4. User can now interact via bot
   → Bot JWT attached to subsequent requests
```

### TelegramLinkToken Model

| Field | Type | Description |
|-------|------|-------------|
| `token` | String | Opaque hex token (unique) |
| `userId` | String | Target user ID |
| `expiresAt` | DateTime | Token expiration |
| `usedAt` | DateTime? | Usage timestamp |

### Token Generation

```typescript
AuthService.generateLinkToken(userId: string): string {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  await prisma.telegramLinkToken.create({
    data: { token, userId, expiresAt }
  });

  return token;
}
```

### Token Redemption

```typescript
AuthService.redeemLinkToken(token: string, telegramId: bigint, username: string) {
  // 1. Find and validate token
  const linkToken = await prisma.telegramLinkToken.findUnique({ where: { token } });
  if (!linkToken || linkToken.usedAt || linkToken.expiresAt < new Date()) {
    throw new BadRequestException('Invalid or expired token');
  }

  // 2. Create TelegramAccount
  await prisma.telegramAccount.create({
    data: {
      telegramId,
      username,
      userId: linkToken.userId
    }
  });

  // 3. Mark token as used
  await prisma.telegramLinkToken.update({
    where: { id: linkToken.id },
    data: { usedAt: new Date() }
  });

  // 4. Issue bot JWT (30 days)
  const botToken = this.jwtService.sign(
    { userId: linkToken.userId },
    { expiresIn: '30d', secret: process.env.JWT_SECRET }
  );

  return { token: botToken };
}
```

## Authorization Guards

### Guard Hierarchy

```
Request
  → AuthGuard (authenticate & attach user)
    → SupabaseUserGuard (verify Supabase user has DB row)
      → RolesGuard OR AssociationRolesGuard (check permissions)
        → Controller Handler
```

### SupabaseUserGuard

Location: `apps/api/src/common/guards/supabase-user.guard.ts`

**Purpose**: Ensures a Supabase-authenticated user has a matching row in the `User` table.

**Behavior**:
- Passes for bot-token requests (bot users are already in DB)
- Rejects Supabase JWT requests if no `User` row exists with matching `supabaseUserId`
- Used on web-only endpoints to prevent bot users from accessing web features

### RolesGuard

Location: `apps/api/src/common/guards/roles.guard.ts`

**Use Case**: System-scoped endpoints (no association context).

**Examples**:
- `POST /associations` (create association)
- Title catalog management
- System admin operations

**Logic**:
```typescript
canActivate(context): boolean {
  const requiredRoles = this.reflector.get<Role[]>('roles', context.getHandler());

  // No metadata → open to any authenticated user
  if (!requiredRoles) return true;

  const user = request.user;

  // SYSTEM_ADMIN bypasses all checks
  if (user.systemRole === 'SYSTEM_ADMIN') return true;

  // Check if user has any active membership with required role
  return user.memberships.some(m => requiredRoles.includes(m.role));
}
```

**Decorator**: `@Roles(...UserRole[])`

### AssociationRolesGuard

Location: `apps/api/src/common/guards/association-roles.guard.ts`

**Use Case**: Association-scoped endpoints (routes with `:associationId` or `:id`).

**Examples**:
- `GET /associations/:associationId/tasks`
- `POST /associations/:associationId/members`
- `PATCH /associations/:id`

**Logic**:
```typescript
canActivate(context): boolean {
  const requiredRoles = this.reflector.get<Role[]>('associationRoles', context.getHandler());

  // No metadata → open to any authenticated user
  if (!requiredRoles) return true;

  const user = request.user;
  const associationId = request.params.associationId || request.params.id;

  // SYSTEM_ADMIN bypasses all checks
  if (user.systemRole === 'SYSTEM_ADMIN') return true;

  // Check if user has active membership in THIS association with required role
  return user.memberships.some(
    m => m.associationId === associationId &&
         m.isActive &&
         requiredRoles.includes(m.role)
  );
}
```

**Decorator**: `@AssociationRoles(...UserRole[])`

### Critical Security Note

**Both guards return `true` when no role metadata is present.**

```typescript
// DANGER: This handler is open to ANY authenticated user
@Get()
findAll() { ... }

// SAFE: This handler requires specific roles
@Get()
@AssociationRoles(UserRole.ASSOCIATION_MANAGER, UserRole.ASSOCIATION_SECRETARY)
findAll() { ... }
```

**Rule**: Always decorate handlers you want restricted with `@Roles` or `@AssociationRoles`.

## Guard Chain by Endpoint Type

### System-Scoped Endpoints

```
AuthGuard → SupabaseUserGuard → RolesGuard
```

**Controller Example**:
```typescript
@Controller('associations')
@UseGuards(AuthGuard, SupabaseUserGuard, RolesGuard)
@UsePipes(ZodValidationPipe)
export class AssociationsController {
  @Post()
  @Roles(UserRole.SYSTEM_ADMIN)
  create(@Body() dto: CreateAssociationDto) { ... }

  @Get()
  @Roles(UserRole.SYSTEM_ADMIN)
  findAll() { ... }
}
```

### Association-Scoped Endpoints

```
AuthGuard → SupabaseUserGuard → AssociationRolesGuard
```

**Controller Example**:
```typescript
@Controller('associations/:associationId/tasks')
@UseGuards(AuthGuard, SupabaseUserGuard, AssociationRolesGuard)
@UsePipes(ZodValidationPipe)
export class TasksController {
  @Get()
  @AssociationRoles(UserRole.ASSOCIATION_MANAGER, UserRole.ASSOCIATION_SECRETARY, UserRole.ASSOCIATION_MEMBER)
  findAll(@Param('associationId') associationId: string) { ... }

  @Post()
  @AssociationRoles(UserRole.ASSOCIATION_MANAGER, UserRole.ASSOCIATION_SECRETARY)
  create(@Param('associationId') associationId: string, @Body() dto: CreateTaskDto) { ... }
}
```

## Role Capabilities Matrix

`SYSTEM_ADMIN` bypasses both role guards and can do everything.

| Action | MANAGER (Başkan) | SECRETARY (Sekreter) | MEMBER (Üye) |
|--------|------------------|----------------------|--------------|
| Create association | ✗ (SYSTEM_ADMIN only) | ✗ | ✗ |
| List/read associations | own only | own only | own only |
| Manage members (add/update/remove) | ✓ | ✓ | ✗ |
| Create task (assignee must have Telegram) | ✓ | ✓ | ✗ |
| List tasks | ✓ | ✓ | ✓ |
| Update own task status | ✓ (own) | ✓ (own) | ✓ (own) |
| Create meeting note | ✓ | ✓ | ✗ |
| List/read meeting notes | ✓ | ✓ | ✓ |
| Manage MemberTitleDefinition catalog | ✗ | ✗ | ✗ |
| Create events | ✓ | ✓ | ✗ |
| Manage event roles | ✓ | ✓ | ✗ |
| Create transactions | ✓ | ✓ | ✗ |
| View finance | ✓ | ✓ | With permission |

### Task Assignment Precondition

`TasksService.create()` rejects with `BadRequestException` when the assignee has no `TelegramAccount` row.

**Reason**: Reminder/notification delivery happens over Telegram. A member who has never run the bot's `/link` flow cannot receive task notifications.

**Solution**: Ensure member has linked Telegram account before assignment:
- Member self-links via `/settings/telegram` in bot
- Admin generates link token via member roster

## Custom Decorators

### @CurrentUser()

Extracts `RequestUser` (subset of `AuthenticatedUser`) from request.

```typescript
@Get('me')
getProfile(@CurrentUser() user: RequestUser) {
  return user;
}
```

### @CurrentOrg()

Extracts association ID from request context.

```typescript
@Get()
getTasks(@CurrentOrg() associationId: string) {
  return this.tasksService.findAll(associationId);
}
```

### @Roles()

Metadata for `RolesGuard` (system-scoped).

```typescript
@Post()
@Roles(UserRole.SYSTEM_ADMIN)
create() { ... }
```

### @AssociationRoles()

Metadata for `AssociationRolesGuard` (association-scoped).

```typescript
@Post()
@AssociationRoles(UserRole.ASSOCIATION_MANAGER, UserRole.ASSOCIATION_SECRETARY)
create() { ... }
```

## Frontend Authentication

### Supabase SSR Setup

**Server Client** (`apps/web/src/lib/supabase/server.ts`):
- Used in Server Components and Route Handlers
- `createServerClient()` from `@supabase/ssr`

**Client Client** (`apps/web/src/lib/supabase/client.ts`):
- Used in Client Components
- `createClient()` from `@supabase/ssr`

### Middleware

Location: `apps/web/src/middleware.ts`

**Behavior**:
1. Refreshes session on every request
2. Redirects unauthenticated users to `/login`
3. Attaches session to request cookies

### API Client

Location: `apps/web/src/lib/api/client.ts`

**Features**:
- Auto-attaches `Authorization: Bearer <token>` to requests
- Uses Supabase access token from session
- Feature-specific wrappers (e.g., `associations.ts`, `tasks.ts`)

### Role-Based UI

Location: `apps/web/src/lib/permissions.ts`

**Functions**:
- `isSystemAdmin(user)` - Check if user is SYSTEM_ADMIN
- `hasAnyMembership(user)` - Check if user has any association membership
- `hasRoleInAssociation(user, associationId, ['ASSOCIATION_MANAGER'])` - Check specific role
- `canAccessRoute(user, 'member' | 'auth' | 'system_admin')` - Route access check
- `filterNav(items, user)` - Filter navigation items by permissions
- `userRoleLabel(user)` - Turkish surface label (Başkan, Sekreter, Üye, Sistem Yöneticisi)

**Rule**: Do not reimplement role checks inline. Use these centralized functions.

### Server Component Data Fetching

Server Components fetch from NestJS API directly using Supabase access token:

```typescript
// Server Component
async function getTasks(associationId: string, accessToken: string) {
  const response = await fetch(`${API_URL}/api/v1/associations/${associationId}/tasks`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  return response.json();
}
```

## Security Best Practices

### Backend

1. **Always decorate handlers** - Undecorated handlers are open to any authenticated user
2. **Filter by associationId AND deletedAt** - All tenant-scoped queries
3. **Use provisioning saga pattern** - Atomic Supabase + DB user creation with rollback
4. **Never expose SUPABASE_SERVICE_ROLE_KEY** - Backend only, never in web or NEXT_PUBLIC_* vars
5. **Validate token type** - AuthGuard handles this, but be aware of dual-mode auth

### Frontend

1. **Use centralized permissions** - Don't reimplement role checks
2. **Server Components for data** - Fetch from API with access token
3. **Middleware for auth** - Let middleware handle session refresh and redirects
4. **Never use service role key** - Only use anon key in NEXT_PUBLIC_* vars

## Common Pitfalls

### 1. Missing Role Decorator

```typescript
// WRONG: Open to any authenticated user
@Get(':id')
findOne(@Param('id') id: string) { ... }

// CORRECT: Restricted to specific roles
@Get(':id')
@AssociationRoles(UserRole.ASSOCIATION_MANAGER, UserRole.ASSOCIATION_SECRETARY)
findOne(@Param('id') id: string) { ... }
```

### 2. Missing Soft Delete Filter

```typescript
// WRONG: Returns deleted records
prisma.task.findMany({ where: { associationId } });

// CORRECT: Filters soft-deleted records
prisma.task.findMany({ where: { associationId, deletedAt: null } });
```

### 3. Silent Rollback Failure

```typescript
// WRONG: Leaves orphaned Supabase user
try {
  await prisma.$transaction([...]);
} catch (error) {
  // Silently swallowed
}

// CORRECT: Rollback and rethrow
try {
  await prisma.$transaction([...]);
} catch (error) {
  await supabaseAdmin.deleteUser(supabaseUserId);
  throw error;
}
```

### 4. Missing Telegram Account Check

```typescript
// WRONG: Assigns task to user without Telegram
await prisma.task.create({
  data: { assignedToUserId: userId, ... }
});

// CORRECT: Validate Telegram account first
const telegramAccount = await prisma.telegramAccount.findUnique({ where: { userId } });
if (!telegramAccount) {
  throw new BadRequestException('Assignee must have linked Telegram account');
}
```
