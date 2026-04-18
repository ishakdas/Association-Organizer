# Testing Guide

## Philosophy

V1 uses **one happy-path integration test per app**. No unit test sprawl. Tests use real infrastructure (Docker PostgreSQL, fake AI provider) rather than mocks.

## Running Tests

```bash
# Run all tests
pnpm test

# Run tests for a specific package
pnpm --filter api test
pnpm --filter @ticketbot/ai test

# Run with verbose output
pnpm --filter api test -- --verbose
```

## Test Infrastructure

### Database

The API integration test requires a running PostgreSQL instance. It uses the `DATABASE_URL` from the environment.

**For local testing:**
```bash
docker compose up -d postgres
export DATABASE_URL="postgresql://ticketbot:ticketbot@localhost:5432/ticketbot"
export JWT_SECRET="test-secret-min-32-chars-long!!!"
pnpm --filter api test
```

If `DATABASE_URL` is not set, the test skips with a warning.

### AI Provider

The AI lib uses `FakeAiProvider` for tests — no OpenAI API calls are made. The fake provider returns pre-configured responses:

```typescript
const fakeProvider = new FakeAiProvider();
fakeProvider.setResponse('extractActionItems', {
  actionItems: [
    { content: 'Review PR #123', assigneeName: 'John' },
  ],
});
```

## Existing Tests

### `libs/ai/src/__tests__/ai.service.spec.ts`

3 tests using `FakeAiProvider`:
1. Extracts action items from meeting notes
2. Handles empty action items
3. Throws when no response is configured

### `apps/api/src/modules/tickets/tickets.controller.spec.ts`

1 integration test:
1. Seeds a test org, admin, and member with memberships
2. Admin creates a ticket via `POST /api/v1/tickets`
3. Member lists tickets via `GET /api/v1/tickets`
4. Verifies the created ticket appears in the list
5. Cleans up all test data after

## Writing New Tests

### Integration Test Pattern (API)

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { NestFastifyApplication, FastifyAdapter } from '@nestjs/platform-fastify';
import { AppModule } from '../../app.module';

describe('MyModule (integration)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return; // skip without DB

    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.setGlobalPrefix('api/v1');
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('should do something', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/endpoint',
      headers: {
        authorization: `Bearer ${token}`,
        'x-organisation-id': orgId,
      },
    });
    expect(res.statusCode).toBe(200);
  });
});
```

### Unit Test Pattern (Libs)

```typescript
describe('MyService', () => {
  it('should transform data', () => {
    const result = myFunction(input);
    expect(result).toEqual(expected);
  });
});
```

### Jest Configuration

Each testable package has its own `jest.config.ts` with `moduleNameMapper` to resolve `@ticketbot/*` workspace imports:

```typescript
moduleNameMapper: {
  '^@ticketbot/database$': '<rootDir>/../../libs/database/src/index.ts',
  '^@ticketbot/shared-validation$': '<rootDir>/../../libs/shared-validation/src/index.ts',
}
```

## Missing Tests (Tracked Issues)

The v1 spec requires "one happy-path integration test per app." Currently missing:

- **Bot app** — no tests ([#15](https://github.com/ishakdas/Association-Organizer/issues/15))
- **Web app** — no tests ([#16](https://github.com/ishakdas/Association-Organizer/issues/16))

## Future Test Expansion

When implementing stubbed modules, each should have at least one integration test covering the happy path. Prioritise:

1. **Ticket comments** — CRUD through the API ([#1](https://github.com/ishakdas/Association-Organizer/issues/1))
2. **Meeting notes + AI extraction** — create note, trigger extraction, verify results ([#4](https://github.com/ishakdas/Association-Organizer/issues/4))
3. **Deadline extensions** — request, approve/reject flow ([#5](https://github.com/ishakdas/Association-Organizer/issues/5))
4. **Organisation management** — create org, invite member, role changes ([#2](https://github.com/ishakdas/Association-Organizer/issues/2))

## Load Testing

Performance baselines should be established before production launch. See [#46](https://github.com/ishakdas/Association-Organizer/issues/46) for the full load testing plan including k6 scripts, target metrics, and test scenarios.
