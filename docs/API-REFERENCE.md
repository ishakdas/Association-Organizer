# API Reference

Base URL: `http://localhost:3000/api/v1` (development)

All endpoints require authentication unless noted. Include the Supabase access token or bot JWT in the `Authorization` header:
```
Authorization: Bearer <token>
```

Multi-tenant endpoints require the `x-organisation-id` header:
```
x-organisation-id: <organisationId>
```

## Error Format

All errors follow [RFC 7807 Problem Details](https://www.rfc-editor.org/rfc/rfc7807):

```json
{
  "type": "about:blank",
  "title": "Validation Error",
  "status": 400,
  "detail": "Request failed validation",
  "instance": "/api/v1/tickets",
  "errors": {
    "title": ["Required"]
  }
}
```

---

## Auth

### Generate Telegram Link Token

```
POST /api/v1/auth/telegram-link
```

**Auth:** Required (Supabase JWT)

**Response:**
```json
{
  "token": "a1b2c3d4...",
  "expiresAt": "2026-04-17T12:10:00.000Z"
}
```

Tokens expire after 10 minutes. The user sends this token to the bot via `/link <token>`.

### Redeem Telegram Link Token

```
POST /api/v1/auth/redeem-telegram-link
```

**Auth:** None (called by the bot internally)

**Body:**
```json
{
  "token": "a1b2c3d4...",
  "telegramId": "123456789",
  "username": "johndoe",
  "firstName": "John"
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Errors:**
- `400` — Invalid, expired, or already-used token

---

## Tickets (Implemented)

### Create Ticket

```
POST /api/v1/tickets
```

**Auth:** Required | **Tenant:** Required | **Roles:** Any member

**Body:**
```json
{
  "title": "Fix login page redirect",
  "description": "Users stuck in redirect loop",
  "priority": "HIGH",
  "assigneeId": "clx123...",
  "dueDate": "2026-04-20T00:00:00.000Z"
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `title` | string | Yes | 1-255 characters |
| `description` | string | No | Max 5000 characters |
| `priority` | enum | No | `LOW`, `MEDIUM` (default), `HIGH`, `URGENT` |
| `assigneeId` | string | No | Must be a valid user ID (cuid) |
| `dueDate` | string | No | ISO 8601 datetime |

**Response:** `201` with the created ticket object.

### List Tickets

```
GET /api/v1/tickets
```

**Auth:** Required | **Tenant:** Required | **Roles:** Any member

**Query Parameters:**
| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `status` | enum | — | Filter by status |
| `priority` | enum | — | Filter by priority |
| `assigneeId` | string | — | Filter by assignee |
| `page` | number | 1 | Page number (1-based) |
| `limit` | number | 20 | Items per page (1-100) |

**Response:**
```json
{
  "data": [
    {
      "id": "clx123...",
      "title": "Fix login page redirect",
      "description": "Users stuck in redirect loop",
      "status": "OPEN",
      "priority": "HIGH",
      "organisationId": "clx456...",
      "creatorId": "clx789...",
      "assigneeId": "clxabc...",
      "dueDate": "2026-04-20T00:00:00.000Z",
      "createdAt": "2026-04-17T10:00:00.000Z",
      "updatedAt": "2026-04-17T10:00:00.000Z"
    }
  ],
  "meta": {
    "total": 42,
    "page": 1,
    "limit": 20,
    "totalPages": 3
  }
}
```

Soft-deleted tickets (with `deletedAt` set) are excluded automatically.

### Get Ticket

```
GET /api/v1/tickets/:id
```

**Auth:** Required | **Tenant:** Required

**Response:** Ticket object with `comments` and `statusHistory` included.

### Update Ticket

```
PATCH /api/v1/tickets/:id
```

**Auth:** Required | **Tenant:** Required

**Body:** (all fields optional)
```json
{
  "title": "Updated title",
  "status": "IN_PROGRESS",
  "priority": "URGENT",
  "assigneeId": "clxabc...",
  "dueDate": "2026-04-25T00:00:00.000Z"
}
```

When `status` changes, a `TicketStatusHistory` record is created automatically.

**Status transitions:** Any status can transition to any other status. The valid values are:
`OPEN`, `IN_PROGRESS`, `WAITING`, `RESOLVED`, `CLOSED`, `REOPENED`

### Delete Ticket (Soft Delete)

```
DELETE /api/v1/tickets/:id
```

**Auth:** Required | **Tenant:** Required

Sets `deletedAt` to current timestamp. The ticket no longer appears in list queries but remains in the database.

---

## Stubbed Endpoints (Tracked Issues)

These modules are scaffolded with TODO comments. Each links to a GitHub issue with full requirements.

### Comments ([#1](https://github.com/ishakdas/Association-Organizer/issues/1))
```
POST   /api/v1/tickets/:ticketId/comments   — Create comment
GET    /api/v1/tickets/:ticketId/comments   — List comments
PATCH  /api/v1/comments/:id                 — Edit own comment
DELETE /api/v1/comments/:id                 — Delete own comment
```

### Organisations ([#2](https://github.com/ishakdas/Association-Organizer/issues/2))
```
POST  /api/v1/organisations                 — Create org (SUPER_ADMIN)
GET   /api/v1/organisations                 — List user's orgs
GET   /api/v1/organisations/:id             — Get org details
PATCH /api/v1/organisations/:id             — Update org (ADMIN+)
POST  /api/v1/organisations/:id/members     — Invite member
GET   /api/v1/organisations/:id/members     — List members
```

### Users ([#3](https://github.com/ishakdas/Association-Organizer/issues/3))
```
GET   /api/v1/users/me                      — Current user profile
PATCH /api/v1/users/me                      — Update profile
GET   /api/v1/users/me/telegram             — Telegram account status
```

### Meeting Notes ([#4](https://github.com/ishakdas/Association-Organizer/issues/4))
```
POST   /api/v1/meeting-notes                — Create note
GET    /api/v1/meeting-notes                — List notes for org
GET    /api/v1/meeting-notes/:id            — Get note with extracted items
PATCH  /api/v1/meeting-notes/:id            — Update note
DELETE /api/v1/meeting-notes/:id            — Soft delete
POST   /api/v1/meeting-notes/:id/extract    — Trigger AI extraction
```

### Extensions ([#5](https://github.com/ishakdas/Association-Organizer/issues/5))
```
POST  /api/v1/extensions                    — Request deadline extension
GET   /api/v1/extensions                    — List pending (MANAGER+)
PATCH /api/v1/extensions/:id/resolve        — Approve/reject (MANAGER+)
```

### Future Endpoints (Not Yet Documented)
- `POST /api/v1/auth/logout` — Token revocation ([#23](https://github.com/ishakdas/Association-Organizer/issues/23))
- `GET /health` — Health check with DB/Redis status ([#30](https://github.com/ishakdas/Association-Organizer/issues/30))
- `DELETE /api/v1/users/me` — GDPR data deletion ([#58](https://github.com/ishakdas/Association-Organizer/issues/58))
- `GET /api/v1/users/me/export` — GDPR data export ([#58](https://github.com/ishakdas/Association-Organizer/issues/58))
- `POST /api/v1/attachments/upload` — File uploads ([#54](https://github.com/ishakdas/Association-Organizer/issues/54))
- `GET /api/v1/users/me/tickets` — Cross-org ticket view ([#53](https://github.com/ishakdas/Association-Organizer/issues/53))

---

## Authentication Details

### Web Users (Supabase JWT)

1. User logs in via Supabase Auth (email/password, OAuth, etc.)
2. Supabase issues a JWT with `sub` = Supabase user ID
3. Web app includes the JWT in `Authorization: Bearer <token>`
4. API verifies the JWT using `SUPABASE_JWT_SECRET` (symmetric HS256)
5. API looks up the `User` record by `supabaseId` matching `sub`

### Bot Users (HS256 JWT)

1. User links Telegram via `/link <token>` in the bot
2. API issues a JWT signed with `JWT_SECRET` containing `{ sub: userId, telegramId, organisationId }`
3. Bot sends this JWT with API requests
4. API checks the `alg` header to determine verification path

### Role Hierarchy

Roles are hierarchical. Higher roles inherit all permissions of lower roles:

```
SUPER_ADMIN > ADMIN > MANAGER > MEMBER
```

The `@Roles()` decorator specifies the minimum required role. A `SUPER_ADMIN` can access any endpoint.

### Tenant Isolation

Every tenant-scoped request must include `x-organisation-id`. The `TenantGuard`:
1. Reads the org ID from the header
2. Verifies the authenticated user has a `Membership` in that org
3. Attaches `organisationId` and `membership` to the request context
4. Service layer uses the org ID to scope all database queries
