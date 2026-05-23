# Shared Libraries

## Overview

The monorepo contains five shared libraries under `libs/` that provide common functionality across all applications. These libraries are imported via path aliases defined in `tsconfig.base.json`.

## Library Structure

```
libs/
├── database/              # @ticketbot/database
├── shared-types/          # @ticketbot/shared-types
├── shared-validation/     # @ticketbot/shared-validation
├── core/                  # @ticketbot/core
└── ai/                    # @ticketbot/ai
```

## Path Aliases

Defined in `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "paths": {
      "@ticketbot/database": ["libs/database/src/index.ts"],
      "@ticketbot/shared-types": ["libs/shared-types/src/index.ts"],
      "@ticketbot/shared-validation": ["libs/shared-validation/src/index.ts"],
      "@ticketbot/core": ["libs/core/src/index.ts"],
      "@ticketbot/ai": ["libs/ai/src/index.ts"]
    }
  }
}
```

---

## @ticketbot/database

### Purpose

Provides Prisma service, module, and enum re-exports for database access across the application.

### Structure

```
libs/database/
├── prisma/
│   ├── schema.prisma           # Database schema definition
│   └── migrations/             # Database migrations
├── src/
│   ├── index.ts                # Re-exports
│   ├── prisma.service.ts       # PrismaService class
│   └── prisma.module.ts        # PrismaModule for NestJS
└── package.json
```

### PrismaService

```typescript
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }
  
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

### PrismaModule

```typescript
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

### Usage

```typescript
import { PrismaModule, PrismaService } from '@ticketbot/database';

@Module({
  imports: [PrismaModule],
  providers: [MyService],
})
export class MyModule {}

@Injectable()
export class MyService {
  constructor(private prisma: PrismaService) {}
  
  async findAll() {
    return this.prisma.user.findMany();
  }
}
```

### Enum Re-exports

Enums from Prisma schema are re-exported for use in application code:

```typescript
export {
  UserRole,
  TaskStatus,
  TaskPriority,
  ReminderFrequency,
  TaskActivityAction,
  EventType,
  RecurrenceType,
  PendingBranchStatus,
  TransactionType,
} from '@prisma/client';
```

### Package Configuration

```json
{
  "name": "@ticketbot/database",
  "version": "0.0.1",
  "main": "src/index.ts",
  "scripts": {
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev"
  }
}
```

---

## @ticketbot/shared-types

### Purpose

Provides TypeScript interfaces, DTOs, and domain enums that are shared between API and web. Enums are duplicated here from Prisma so web/validation packages don't depend on Prisma.

### Structure

```
libs/shared-types/
├── src/
│   ├── index.ts                # Re-exports
│   ├── authenticated-user.ts   # Auth-related types
│   ├── enums.ts                # Duplicated enums
│   └── domain/                 # Domain DTOs
│       ├── association.ts
│       ├── task.ts
│       ├── event.ts
│       └── ...
└── package.json
```

### AuthenticatedUser

```typescript
export interface AuthenticatedUser {
  id: string;
  email: string | null;
  systemRole: UserRole;
  memberships: AuthMembership[];
}

export interface AuthMembership {
  associationId: string;
  role: UserRole;
  titleId: string | null;
  customTitle: string | null;
  isActive: boolean;
}

export interface RequestUser {
  id: string;
  email: string | null;
  systemRole: UserRole;
  memberships: AuthMembership[];
}
```

### Domain Enums

```typescript
// Duplicated from Prisma to avoid Prisma dependency in web
export enum UserRole {
  SYSTEM_ADMIN = 'SYSTEM_ADMIN',
  ASSOCIATION_MANAGER = 'ASSOCIATION_MANAGER',
  ASSOCIATION_SECRETARY = 'ASSOCIATION_SECRETARY',
  ASSOCIATION_MEMBER = 'ASSOCIATION_MEMBER',
}

export enum TaskStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum TaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

export enum EventType {
  CONFERENCE = 'CONFERENCE',
  TALK = 'TALK',
  SEMINAR = 'SEMINAR',
  IFTAR = 'IFTAR',
  KANDIL = 'KANDIL',
  MEETING = 'MEETING',
  CUSTOM = 'CUSTOM',
}
```

### Domain DTOs

**Association DTOs**:

```typescript
export interface CreateAssociationDto {
  name: string;
  shortName?: string;
  taxNumber?: string;
  foundedAt: string;
  city: string;
  district: string;
  email: string;
  activityArea: string;
}

export interface UpdateAssociationDto {
  name?: string;
  shortName?: string;
  address?: string;
  phone?: string;
  website?: string;
  logoUrl?: string;
}

export interface AssociationResponse {
  id: string;
  name: string;
  shortName: string | null;
  city: string;
  district: string;
  email: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
```

**Task DTOs**:

```typescript
export interface CreateTaskDto {
  title: string;
  description?: string;
  assignedToUserId: string;
  priority?: TaskPriority;
  dueDate?: string;
}

export interface UpdateTaskDto {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string;
}

export interface TaskResponse {
  id: string;
  associationId: string;
  title: string;
  description: string | null;
  assignedToUserId: string;
  assignedById: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  disputed: boolean;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}
```

### Usage

**In API**:

```typescript
import { CreateAssociationDto, AssociationResponse } from '@ticketbot/shared-types';

@Post()
create(@Body() dto: CreateAssociationDto): Promise<AssociationResponse> {
  return this.associationsService.create(dto);
}
```

**In Web**:

```typescript
import { CreateAssociationDto } from '@ticketbot/shared-types';

const handleSubmit = (data: CreateAssociationDto) => {
  associationsApi.create(data);
};
```

---

## @ticketbot/shared-validation

### Purpose

Provides Zod validation schemas used for both API validation and frontend forms. Adding a new entity means adding a schema here first.

### Structure

```
libs/shared-validation/
├── src/
│   ├── index.ts                # Re-exports
│   └── schemas/
│       ├── association.ts
│       ├── task.ts
│       ├── event.ts
│       ├── user.ts
│       └── ...
└── package.json
```

### Validation Schemas

**Association Schema**:

```typescript
import { z } from 'zod';

export const associationSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  shortName: z.string().max(50).optional(),
  taxNumber: z.string().regex(/^\d{10}$/, 'Invalid tax number').optional(),
  foundedAt: z.string().datetime('Invalid date'),
  city: z.string().min(1, 'City is required'),
  district: z.string().min(1, 'District is required'),
  email: z.string().email('Invalid email'),
  website: z.string().url('Invalid URL').optional(),
  activityArea: z.string().min(1, 'Activity area is required'),
});

export const createAssociationSchema = associationSchema;

export const updateAssociationSchema = associationSchema.partial();
```

**Task Schema**:

```typescript
import { z } from 'zod';

export const taskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(5000).optional(),
  assignedToUserId: z.string().min(1, 'Assignee is required'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
  dueDate: z.string().datetime('Invalid date').optional(),
});

export const createTaskSchema = taskSchema;

export const updateTaskSchema = taskSchema.partial().extend({
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
});
```

**User Schema**:

```typescript
import { z } from 'zod';

export const userSchema = z.object({
  email: z.string().email('Invalid email').optional(),
  fullName: z.string().min(1, 'Full name is required').max(200),
  phone: z.string().regex(/^\+?\d{10,15}$/, 'Invalid phone number').optional(),
});

export const createUserSchema = userSchema.extend({
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const updateUserSchema = userSchema.partial();
```

**Event Schema**:

```typescript
import { z } from 'zod';

export const eventSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(5000).optional(),
  type: z.enum(['CONFERENCE', 'TALK', 'SEMINAR', 'IFTAR', 'KANDIL', 'MEETING', 'CUSTOM']),
  location: z.string().max(500).optional(),
  startsAt: z.string().datetime('Invalid date'),
  endsAt: z.string().datetime('Invalid date').optional(),
  notifyAt: z.string().datetime('Invalid date'),
  recurrenceType: z.enum(['NONE', 'DAILY', 'WEEKLY', 'MONTHLY']).default('NONE'),
  recurrenceInterval: z.number().int().min(1).default(1),
  recurrenceEndsAt: z.string().datetime('Invalid date').optional(),
});

export const createEventSchema = eventSchema;

export const updateEventSchema = eventSchema.partial();
```

### Usage in API

**DTO with Schema**:

```typescript
import { createTaskSchema } from '@ticketbot/shared-validation';

export class CreateTaskDto {
  static schema = createTaskSchema;
  
  title: string;
  description?: string;
  assignedToUserId: string;
  priority?: TaskPriority;
  dueDate?: string;
}
```

**Controller Validation**:

```typescript
@Controller('associations/:associationId/tasks')
@UsePipes(ZodValidationPipe)
export class TasksController {
  @Post()
  @AssociationRoles(UserRole.ASSOCIATION_MANAGER, UserRole.ASSOCIATION_SECRETARY)
  create(@Body() dto: CreateTaskDto) {
    return this.tasksService.create(dto);
  }
}
```

### Usage in Web

**Form Validation**:

```typescript
import { createTaskSchema } from '@ticketbot/shared-validation';

function TaskForm() {
  const [errors, setErrors] = useState({});
  
  const validate = (data: any) => {
    const result = createTaskSchema.safeParse(data);
    if (!result.success) {
      setErrors(result.error.flatten().fieldErrors);
      return false;
    }
    return true;
  };
  
  const handleSubmit = (data: any) => {
    if (validate(data)) {
      tasksApi.create(associationId, data);
    }
  };
  
  return <form onSubmit={handleSubmit}>...</form>;
}
```

---

## @ticketbot/core

### Purpose

Provides shared business logic and utilities used across the application.

### Structure

```
libs/core/
├── src/
│   ├── index.ts                # Re-exports
│   ├── utils/                  # Utility functions
│   │   ├── date.ts
│   │   ├── string.ts
│   │   └── validation.ts
│   └── constants/              # Shared constants
│       └── roles.ts
└── package.json
```

### Common Utilities

**Date Utilities**:

```typescript
export function formatTurkishDate(date: Date): string {
  return new Intl.DateTimeFormat('tr-TR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

export function isOverdue(date: Date): boolean {
  return date < new Date();
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
```

**String Utilities**:

```typescript
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function truncate(text: string, length: number): string {
  if (text.length <= length) return text;
  return text.slice(0, length) + '...';
}
```

**Validation Utilities**:

```typescript
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidPhone(phone: string): boolean {
  return /^\+?\d{10,15}$/.test(phone);
}
```

### Constants

**Role Labels**:

```typescript
export const ROLE_LABELS: Record<UserRole, string> = {
  SYSTEM_ADMIN: 'Sistem Yöneticisi',
  ASSOCIATION_MANAGER: 'Başkan',
  ASSOCIATION_SECRETARY: 'Sekreter',
  ASSOCIATION_MEMBER: 'Üye',
};

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  SYSTEM_ADMIN: 4,
  ASSOCIATION_MANAGER: 3,
  ASSOCIATION_SECRETARY: 2,
  ASSOCIATION_MEMBER: 1,
};
```

---

## @ticketbot/ai

### Purpose

Provides AI provider interface and implementations for generating Islamic event suggestions. Supports OpenAI and fake (mock) implementations for testing.

### Structure

```
libs/ai/
├── src/
│   ├── index.ts                # Re-exports
│   ├── ai-provider.ts          # Provider interface
│   ├── openai.provider.ts      # OpenAI implementation
│   ├── fake.provider.ts        # Mock implementation
│   └── prompts/                # Prompt definitions
│       ├── suggest-events.ts
│       └── generate-schedule.ts
└── package.json
```

### AiProvider Interface

```typescript
export interface AiProvider {
  generateSuggestion(prompt: string, options?: GenerationOptions): Promise<AiResponse>;
  generateChat(messages: ChatMessage[]): Promise<string>;
}

export interface GenerationOptions {
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

export interface AiResponse {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}
```

### OpenAI Provider

```typescript
export class OpenAiProvider implements AiProvider {
  private openai: OpenAI;
  
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  
  async generateSuggestion(prompt: string, options?: GenerationOptions): Promise<AiResponse> {
    const completion = await this.openai.chat.completions.create({
      model: options?.model || 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: options?.temperature || 0.7,
      max_tokens: options?.maxTokens || 2000,
      response_format: { type: 'json_object' },
    });
    
    return {
      content: completion.choices[0].message.content,
      usage: {
        promptTokens: completion.usage?.prompt_tokens || 0,
        completionTokens: completion.usage?.completion_tokens || 0,
        totalTokens: completion.usage?.total_tokens || 0,
      },
    };
  }
  
  async generateChat(messages: ChatMessage[]): Promise<string> {
    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages,
      temperature: 0.7,
    });
    
    return completion.choices[0].message.content;
  }
}
```

### Fake Provider

```typescript
export class FakeAiProvider implements AiProvider {
  async generateSuggestion(prompt: string, options?: GenerationOptions): Promise<AiResponse> {
    return {
      content: JSON.stringify({
        title: 'Sample Islamic Event',
        description: 'This is a sample suggestion for testing.',
        category: 'sohbet',
        keyTopics: ['Islamic values', 'Community building'],
        resourcesNeeded: 'Meeting room, projector',
        estimatedParticipants: '20-30',
      }),
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      },
    };
  }
  
  async generateChat(messages: ChatMessage[]): Promise<string> {
    return 'This is a mock response for testing.';
  }
}
```

### Prompt Definitions

```typescript
export const SUGGEST_EVENTS_PROMPT = `
You are an AI assistant helping Islamic associations plan events.
Generate event suggestions based on:
- Islamic calendar events (Kandil, Ramadan, etc.)
- Target audience: {targetAudience}
- Period: {period}

Return a JSON object with:
- title: Event title
- description: Detailed description
- category: One of [sohbet, egitim, kultur, genclik, aile, sosyal_sorumluluk, ibadet]
- keyTopics: Array of key topics
- resourcesNeeded: Required resources
- estimatedParticipants: Expected participant count
`;

export const GENERATE_SCHEDULE_PROMPT = `
Generate a detailed schedule for an event with the following details:
- Event: {eventTitle}
- Duration: {duration}
- Type: {eventType}

Return a JSON array of program items with:
- startTime: Start time (HH:MM)
- duration: Duration (e.g., "30 dk")
- title: Item title
- description: Item description
`;
```

### Usage

**In API Module**:

```typescript
import { AiProvider, OpenAiProvider, FakeAiProvider } from '@ticketbot/ai';

@Module({
  providers: [
    {
      provide: AiProvider,
      useClass: process.env.NODE_ENV === 'test' ? FakeAiProvider : OpenAiProvider,
    },
    AiHelperService,
  ],
})
export class AiHelperModule {}
```

**In Service**:

```typescript
@Injectable()
export class AiHelperService {
  constructor(
    @Inject(AiProvider)
    private aiProvider: AiProvider,
    private prisma: PrismaService,
  ) {}
  
  async generateSuggestion(
    associationId: string,
    options: SuggestionOptions
  ): Promise<AiSuggestion> {
    const prompt = this.buildPrompt(options);
    
    const response = await this.aiProvider.generateSuggestion(prompt, {
      temperature: 0.8,
      maxTokens: 2000,
    });
    
    const suggestion = JSON.parse(response.content);
    
    return this.prisma.aiSuggestion.create({
      data: {
        associationId,
        createdById: options.userId,
        period: options.period,
        targetAudience: options.targetAudience,
        ...suggestion,
        metadata: {
          temperature: 0.8,
          promptVersion: '1.0',
        },
      },
    });
  }
}
```

---

## Library Dependencies

```
@ticketbot/database
└── @prisma/client

@ticketbot/shared-types
└── (no dependencies - plain TypeScript)

@ticketbot/shared-validation
└── zod

@ticketbot/core
└── (no external dependencies)

@ticketbot/ai
└── openai
```

## Usage Guidelines

### When to Add to Shared Libraries

**Add to @ticketbot/shared-types**:
- New domain DTOs
- Response types
- Enum values used by multiple apps

**Add to @ticketbot/shared-validation**:
- New Zod schemas for entities
- Form validation schemas
- API request/response validation

**Add to @ticketbot/core**:
- Utility functions used by 2+ apps
- Shared constants
- Business logic not tied to a specific module

**Add to @ticketbot/ai**:
- New AI provider implementations
- Prompt templates
- AI-related types

### When NOT to Add to Shared Libraries

- Module-specific logic (belongs in the module)
- UI components (belongs in web)
- Database queries (belongs in services)
- Configuration (belongs in config)

## Versioning

All libraries share the same version as the monorepo (`0.0.0`). When publishing:

1. Update version in all `package.json` files
2. Run `pnpm build` to compile
3. Test all dependent apps
4. Publish to registry (if applicable)

## Testing

### Unit Tests

Each library can have its own tests:

```
libs/shared-validation/
├── src/
└── tests/
    └── schemas.test.ts
```

Run library tests:

```bash
nx run shared-validation:test
```

### Integration Tests

Test libraries with their consumers:

```bash
nx run api:test -- --testPathPattern=associations
```

## Build Configuration

Each library has a `project.json` for Nx:

```json
{
  "name": "shared-validation",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "libs/shared-validation/src",
  "projectType": "library",
  "targets": {
    "build": {
      "executor": "@nx/js:tsc",
      "outputs": ["{options.outputPath}"],
      "options": {
        "outputPath": "dist/libs/shared-validation",
        "main": "libs/shared-validation/src/index.ts",
        "tsConfig": "libs/shared-validation/tsconfig.json"
      }
    },
    "test": {
      "executor": "@nx/jest:jest",
      "outputs": ["{workspaceRoot}/coverage/{projectRoot}"],
      "options": {
        "jestConfig": "libs/shared-validation/jest.config.ts"
      }
    }
  }
}
```
