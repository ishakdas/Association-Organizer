# Development Workflow

## Overview

This document covers the development commands, code conventions, testing strategies, and best practices for the Association Organizer monorepo.

## Development Commands

### Root Commands

All commands are run from the repository root using pnpm:

```bash
# Start all apps in parallel (api :3000, web :3001, bot inside api)
pnpm dev

# Start individual apps
pnpm dev:api          # NestJS API on port 3000
pnpm dev:web          # Next.js web on port 3001
pnpm dev:bot          # Bot (runs inside API process)

# Build / Lint / Test (all packages via Nx)
pnpm build
pnpm lint
pnpm test

# Database operations
pnpm db:generate      # Prisma generate client
pnpm db:migrate       # Prisma migrate dev
pnpm db:migrate:deploy # Prisma migrate deploy (production)
pnpm db:seed          # Seed database with initial data
pnpm db:studio        # Open Prisma Studio UI
pnpm db:dev-reset     # Reset development database
```

### Nx Commands

Direct Nx commands for specific packages:

```bash
# Build specific package
nx run api:build
nx run web:build

# Test specific package
nx run api:test
nx run web:test

# Test with pattern
nx run api:test -- --testPathPattern=associations.service.spec

# Lint specific package
nx run api:lint
nx run web:lint

# View dependency graph
nx graph
```

### Filtered pnpm Commands

```bash
# Run command in specific workspace
pnpm --filter api test:e2e
pnpm --filter api start

# Install dependencies for specific workspace
pnpm --filter web add <package>
```

## Environment Setup

### Prerequisites

- **Node.js**: Version specified in `.nvmrc` (v20+)
- **pnpm**: Version 10.29.3 (specified in `package.json`)
- **PostgreSQL**: Via Docker Compose or Supabase
- **Redis**: Via Docker Compose (for future BullMQ)

### Initial Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Set up environment files
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

# 3. Start database (if using Docker)
docker-compose up -d

# 4. Generate Prisma client
pnpm db:generate

# 5. Run migrations
pnpm db:migrate

# 6. Seed database
pnpm db:seed

# 7. Start development
pnpm dev
```

### Environment Variables

**API** (`apps/api/.env`):

```env
DATABASE_URL=postgresql://user:password@localhost:5432/db
REDIS_URL=redis://localhost:6379

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret

JWT_SECRET=your-bot-jwt-secret
BOT_TOKEN=your-telegram-bot-token

API_URL=http://localhost:3000
WEB_URL=http://localhost:3001
```

**Web** (`apps/web/.env.local`):

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_URL=http://localhost:3000
```

**Important**:
- `SUPABASE_SERVICE_ROLE_KEY` is backend-only
- Never use service role key in web or `NEXT_PUBLIC_*` vars
- Environment is validated on API boot via Zod

## Docker Compose

Local development infrastructure:

```yaml
# docker-compose.yml
version: '3.8'
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: association_organizer
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  postgres_data:
```

Start infrastructure:

```bash
docker-compose up -d
```

## Code Conventions

### TypeScript

- **Strict mode**: Enabled
- **Target**: ES2020
- **Module**: ESNext
- **Module Resolution**: Bundler

### Prettier

Configuration in `.prettierrc`:

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100
}
```

Format code:

```bash
pnpm prettier --write .
```

### ESLint

Configuration in `.eslintrc.json`:

```json
{
  "extends": ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  "parser": "@typescript-eslint/parser",
  "plugins": ["@typescript-eslint"]
}
```

Lint code:

```bash
pnpm lint
```

### Naming Conventions

**Files**:
- Components: `PascalCase.tsx` (e.g., `TaskCard.tsx`)
- Utilities: `camelCase.ts` (e.g., `dateUtils.ts`)
- Tests: `*.spec.ts` or `*.test.ts`
- DTOs: `*.dto.ts` (e.g., `create-task.dto.ts`)

**Variables/Functions**:
- Variables: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- Functions: `camelCase`
- Classes: `PascalCase`
- Interfaces: `PascalCase` (no `I` prefix)

**Database**:
- Tables: `snake_case` (e.g., `association_memberships`)
- Columns: `snake_case` (e.g., `created_at`)
- Models: `PascalCase` (e.g., `AssociationMembership`)

### Import Order

```typescript
// 1. External packages
import { Module } from '@nestjs/common';
import { z } from 'zod';

// 2. Internal libraries
import { PrismaModule } from '@ticketbot/database';
import { CreateTaskDto } from '@ticketbot/shared-types';

// 3. Relative imports
import { TasksService } from './tasks.service';
import { TaskEntity } from './entities/task.entity';
```

## API Development

### Creating a New Module

**1. Create module structure**:

```bash
mkdir -p apps/api/src/modules/x/{dto,entities}
```

**2. Create module file** (`x.module.ts`):

```typescript
import { Module } from '@nestjs/common';
import { PrismaModule } from '@ticketbot/database';
import { XController } from './x.controller';
import { XService } from './x.service';

@Module({
  imports: [PrismaModule],
  controllers: [XController],
  providers: [XService],
  exports: [XService],
})
export class XModule {}
```

**3. Create controller** (`x.controller.ts`):

```typescript
import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { UseGuards, UsePipes } from '@nestjs/common';
import { AuthGuard, SupabaseUserGuard, AssociationRolesGuard } from '../../common/guards';
import { ZodValidationPipe } from '../../common/pipes';
import { AssociationRoles } from '../../common/decorators';
import { UserRole } from '@ticketbot/shared-types';
import { XService } from './x.service';
import { CreateXDto } from './dto/create-x.dto';

@Controller('associations/:associationId/x')
@UseGuards(AuthGuard, SupabaseUserGuard, AssociationRolesGuard)
@UsePipes(ZodValidationPipe)
export class XController {
  constructor(private readonly xService: XService) {}

  @Get()
  @AssociationRoles(UserRole.ASSOCIATION_MANAGER, UserRole.ASSOCIATION_SECRETARY, UserRole.ASSOCIATION_MEMBER)
  findAll(@Param('associationId') associationId: string) {
    return this.xService.findAll(associationId);
  }

  @Post()
  @AssociationRoles(UserRole.ASSOCIATION_MANAGER, UserRole.ASSOCIATION_SECRETARY)
  create(@Param('associationId') associationId: string, @Body() dto: CreateXDto) {
    return this.xService.create(associationId, dto);
  }
}
```

**4. Create service** (`x.service.ts`):

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@ticketbot/database';
import { CreateXDto } from './dto/create-x.dto';

@Injectable()
export class XService {
  constructor(private prisma: PrismaService) {}

  async findAll(associationId: string) {
    return this.prisma.x.findMany({
      where: { associationId, deletedAt: null },
      orderBy: { createdAt: 'desc' }
    });
  }

  async create(associationId: string, dto: CreateXDto) {
    return this.prisma.x.create({
      data: {
        associationId,
        ...dto
      }
    });
  }
}
```

**5. Add Zod schema** (`libs/shared-validation/src/schemas/x.ts`):

```typescript
import { z } from 'zod';

export const createXSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});
```

**6. Register in AppModule**:

```typescript
import { XModule } from './modules/x/x.module';

@Module({
  imports: [
    // ... other modules
    XModule,
  ],
})
export class AppModule {}
```

### Validation Pattern

**DTO with schema**:

```typescript
import { createXSchema } from '@ticketbot/shared-validation';

export class CreateXDto {
  static schema = createXSchema;
  
  name: string;
  description?: string;
}
```

**ZodValidationPipe** picks up schema from DTO class automatically.

### Error Handling

Throw NestJS exceptions with RFC 7807 format:

```typescript
import { NotFoundException, BadRequestException } from '@nestjs/common';

// Not found
throw new NotFoundException('X not found');

// Bad request
throw new BadRequestException('Invalid input');

// Custom error
throw new BadRequestException({
  type: 'https://example.com/errors/invalid-input',
  title: 'Invalid Input',
  status: 400,
  detail: 'The provided data is invalid',
  errors: { name: ['Name is required'] }
});
```

## Database Development

### Creating a Migration

**1. Update schema** (`libs/database/prisma/schema.prisma`):

```prisma
model NewModel {
  id        String   @id @default(cuid())
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?
}
```

**2. Generate migration**:

```bash
pnpm db:migrate
```

This creates a migration file in `libs/database/prisma/migrations/`.

**3. Generate Prisma client**:

```bash
pnpm db:generate
```

### Seeding

Seed file location: `libs/database/prisma/seed.ts`

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create system admin
  const admin = await prisma.user.create({
    data: {
      email: 'admin@example.com',
      fullName: 'System Admin',
      // ...
    }
  });

  // Create sample association
  const association = await prisma.association.create({
    data: {
      name: 'Sample Association',
      createdById: admin.id,
      // ...
    }
  });

  console.log('Seed completed');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

Run seed:

```bash
pnpm db:seed
```

### Prisma Studio

Open database GUI:

```bash
pnpm db:studio
```

Opens at `http://localhost:5555`.

## Testing

### API Tests

**Unit Tests**:

Location: `apps/api/src/modules/x/x.service.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { XService } from './x.service';
import { PrismaService } from '@ticketbot/database';

describe('XService', () => {
  let service: XService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        XService,
        {
          provide: PrismaService,
          useValue: {
            x: {
              findMany: jest.fn(),
              create: jest.fn(),
            }
          }
        }
      ]
    }).compile();

    service = module.get<XService>(XService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should find all', async () => {
    const result = [{ id: '1', name: 'Test' }];
    jest.spyOn(prisma.x, 'findMany').mockResolvedValue(result);

    expect(await service.findAll('assoc-1')).toEqual(result);
  });
});
```

Run API tests:

```bash
nx run api:test
nx run api:test -- --testPathPattern=x.service
```

**E2E Tests**:

Location: `apps/api/test/x.e2e-spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('XController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/associations/:id/x (GET)', () => {
    return request(app.getHttpServer())
      .get('/associations/1/x')
      .expect(200);
  });
});
```

Run E2E tests:

```bash
pnpm --filter api test:e2e
```

### Web Tests

**Current State**: No test harness configured.

**Do NOT run**: `pnpm --filter web test`

**Future Setup**: React Testing Library + Jest

### Test Coverage

View coverage:

```bash
nx run api:test -- --coverage
```

Coverage output in `coverage/` directory.

## Git Workflow

### Branch Strategy

- **main**: Production-ready code
- **develop**: Integration branch
- **feature/***: Feature branches
- **bugfix/***: Bug fix branches
- **hotfix/***: Production hotfixes

### Commit Messages

Follow Conventional Commits:

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Test changes
- `chore`: Build/tooling changes

**Examples**:

```
feat(tasks): add task dispute functionality
fix(auth): fix bot token validation
docs(api): update module documentation
refactor(associations): simplify membership query
test(tasks): add unit tests for task service
chore(deps): update prisma to 5.10.0
```

### Pre-commit Checklist

1. Run lint: `pnpm lint`
2. Run typecheck: `pnpm build`
3. Run tests: `pnpm test`
4. Format code: `pnpm prettier --write .`

**Note**: No pre-commit hooks configured. Manual enforcement required.

## Debugging

### API Debugging

**VS Code Launch Configuration** (`.vscode/launch.json`):

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug API",
      "runtimeArgs": ["run", "dev:api"],
      "runtimeExecutable": "pnpm",
      "console": "integratedTerminal",
      "skipFiles": ["<node_internals>/**"]
    }
  ]
}
```

**Logging**:

```typescript
import { Logger } from '@nestjs/common';

const logger = new Logger(XService.name);

logger.log('Message');
logger.debug('Debug message');
logger.warn('Warning message');
logger.error('Error message', stackTrace);
```

### Web Debugging

Use Next.js dev tools:

```bash
pnpm dev:web
```

Open `http://localhost:3001` with React DevTools.

### Database Debugging

**Prisma Studio**:

```bash
pnpm db:studio
```

**Prisma Query Logging**:

Add to `.env`:

```env
DEBUG=*
```

Or in code:

```typescript
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error']
});
```

## Performance

### API Performance

- Use Fastify adapter (already configured)
- Index database queries
- Use `select` to limit returned fields
- Paginate large result sets

### Web Performance

- Server Components for data fetching
- Dynamic imports for heavy components
- Image optimization via `next/image`
- Route-based code splitting

### Database Performance

- Add indexes for frequent queries
- Use `select` to limit fields
- Avoid N+1 queries with `include`
- Use Prisma's `skip` and `take` for pagination

## Common Issues

### Port Already in Use

```bash
# Kill process on port
lsof -ti:3000 | xargs kill -9
lsof -ti:3001 | xargs kill -9
```

### Prisma Client Out of Sync

```bash
pnpm db:generate
```

### Migration Conflicts

```bash
# Reset database (development only)
pnpm db:dev-reset

# Or manually
rm -rf libs/database/prisma/migrations/*
pnpm db:migrate
```

### Module Not Found

Check `tsconfig.base.json` paths and ensure module is registered in `AppModule`.

## Best Practices

### Security

1. **Never commit `.env` files**
2. **Never expose `SUPABASE_SERVICE_ROLE_KEY` to web**
3. **Always decorate handlers with role decorators**
4. **Filter by `associationId` AND `deletedAt: null`**
5. **Use provisioning saga pattern for user creation**
6. **Validate all inputs with Zod schemas**

### Code Quality

1. **Keep modules small and focused**
2. **Use dependency injection**
3. **Write tests for business logic**
4. **Document complex algorithms**
5. **Use TypeScript strictly (no `any`)**
6. **Handle errors gracefully**

### Database

1. **Always include `deletedAt: null` in queries**
2. **Use transactions for multi-step operations**
3. **Add indexes for foreign keys**
4. **Use `select` to limit returned fields**
5. **Avoid raw SQL unless necessary**

### API Design

1. **Use consistent error format (RFC 7807)**
2. **Version API via URL prefix (`api/v1`)**
3. **Use appropriate HTTP methods**
4. **Return consistent response shapes**
5. **Document endpoints with OpenAPI/Swagger**

### Frontend

1. **Use Server Components for data fetching**
2. **Use centralized permissions (`permissions.ts`)**
3. **Handle loading and error states**
4. **Optimize images with `next/image`**
5. **Use TypeScript for all components**
