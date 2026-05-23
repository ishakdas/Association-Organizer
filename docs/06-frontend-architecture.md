# Frontend Architecture

## Overview

The web application is built with Next.js 15 using the App Router pattern. It provides a responsive interface for association management with role-based UI rendering and Supabase authentication.

## Application Structure

```
apps/web/
├── src/
│   ├── app/                      # App Router pages
│   │   ├── (auth)/               # Authentication routes
│   │   │   ├── login/            # Login page
│   │   │   └── callback/         # OAuth callback handler
│   │   ├── (onboarding)/         # Onboarding flow
│   │   │   └── complete/         # Onboarding completion
│   │   ├── (protected)/          # Authenticated routes
│   │   │   ├── admin/            # Admin panel
│   │   │   │   └── users/        # User management
│   │   │   ├── associations/     # Association pages
│   │   │   │   ├── [id]/         # Association detail
│   │   │   │   │   ├── members/  # Member management
│   │   │   │   │   ├── tasks/    # Task board
│   │   │   │   │   ├── meetings/ # Meeting notes
│   │   │   │   │   ├── events/   # Event management
│   │   │   │   │   └── finance/  # Financial tracking
│   │   │   │   └── new/          # Create association
│   │   │   ├── dashboard/        # Dashboard
│   │   │   ├── events/           # Global events view
│   │   │   ├── settings/         # User settings
│   │   │   │   ├── profile/      # Profile settings
│   │   │   │   └── telegram/     # Telegram linking
│   │   │   └── tasks/            # Global tasks view
│   │   ├── layout.tsx            # Root layout
│   │   ├── not-found.tsx         # 404 page
│   │   └── page.tsx              # Landing page
│   ├── lib/                      # Utilities
│   │   ├── api/                  # API client
│   │   │   ├── client.ts         # Base API client
│   │   │   ├── associations.ts   # Association API wrappers
│   │   │   ├── tasks.ts          # Task API wrappers
│   │   │   └── ...               # Feature-specific wrappers
│   │   ├── supabase/             # Supabase clients
│   │   │   ├── server.ts         # Server Component client
│   │   │   └── client.ts         # Client Component client
│   │   └── permissions.ts        # Role-based permissions
│   ├── components/               # React components
│   │   ├── ui/                   # UI primitives
│   │   ├── layouts/              # Layout components
│   │   └── features/             # Feature-specific components
│   └── styles/                   # Global styles
├── public/                       # Static assets
├── middleware.ts                 # Auth middleware
└── next.config.ts                # Next.js configuration
```

## Routing Architecture

### Route Groups

The app uses route groups to organize authentication flows:

| Group | Purpose | Access |
|-------|---------|--------|
| `(auth)` | Login, OAuth callback | Public |
| `(onboarding)` | First-time user flow | Authenticated (incomplete) |
| `(protected)` | All authenticated pages | Authenticated (complete) |

### Protected Routes

The `(protected)` layout performs server-side auth check:

```typescript
// apps/web/src/app/(protected)/layout.tsx
export default async function ProtectedLayout({ children }) {
  const user = await getAuthenticatedUser();
  
  if (!user) {
    redirect('/login');
  }
  
  if (!user.onboardingCompletedAt) {
    redirect('/onboarding/complete');
  }
  
  return (
    <div className="protected-layout">
      <Sidebar user={user} />
      <main>{children}</main>
    </div>
  );
}
```

### Dynamic Routes

Association-scoped pages use dynamic route segments:

```
/associations/[id]/members
/associations/[id]/tasks
/associations/[id]/meetings
/associations/[id]/events
/associations/[id]/finance
```

## Authentication

### Supabase SSR

**Server Client** (`lib/supabase/server.ts`):

```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function createClient() {
  const cookieStore = cookies();
  
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) { return cookieStore.get(name)?.value; },
        set(name, value, options) { cookieStore.set({ name, value, ...options }); },
        remove(name, options) { cookieStore.set({ name, value: '', ...options }); },
      },
    }
  );
}
```

**Client Client** (`lib/supabase/client.ts`):

```typescript
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

### Middleware

Location: `apps/web/src/middleware.ts`

**Responsibilities**:
1. Refresh session on every request
2. Redirect unauthenticated users to `/login`
3. Handle OAuth callback redirects

```typescript
export async function middleware(request: NextRequest) {
  const supabase = createServerClient(...);
  
  // Refresh session
  const { data: { session } } = await supabase.auth.getSession();
  
  // Protected route check
  if (!session && isProtectedRoute(request.nextUrl.pathname)) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

### User Session

Server Components fetch user from Supabase:

```typescript
export async function getAuthenticatedUser() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return null;
  
  // Fetch full profile from API
  const response = await fetch(`${API_URL}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${user.access_token}` }
  });
  
  return response.json();
}
```

## API Client

### Base Client

Location: `apps/web/src/lib/api/client.ts`

```typescript
class ApiClient {
  private baseUrl: string;
  
  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL;
  }
  
  async request(endpoint: string, options: RequestInit = {}) {
    const token = await getAccessToken();
    
    const response = await fetch(`${this.baseUrl}/api/v1${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new ApiError(error);
    }
    
    return response.json();
  }
  
  get(endpoint: string) {
    return this.request(endpoint);
  }
  
  post(endpoint: string, data: any) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
  
  patch(endpoint: string, data: any) {
    return this.request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }
  
  delete(endpoint: string) {
    return this.request(endpoint, { method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
```

### Feature Wrappers

**Associations** (`lib/api/associations.ts`):

```typescript
export const associationsApi = {
  list: () => apiClient.get('/associations'),
  get: (id: string) => apiClient.get(`/associations/${id}`),
  create: (data: CreateAssociationDto) => apiClient.post('/associations', data),
  update: (id: string, data: UpdateAssociationDto) => apiClient.patch(`/associations/${id}`, data),
  delete: (id: string) => apiClient.delete(`/associations/${id}`),
  
  // Members
  getMembers: (id: string) => apiClient.get(`/associations/${id}/members`),
  addMember: (id: string, data: AddMemberDto) => apiClient.post(`/associations/${id}/members`, data),
  updateMember: (id: string, memberId: string, data: UpdateMemberDto) => 
    apiClient.patch(`/associations/${id}/members/${memberId}`, data),
  removeMember: (id: string, memberId: string) => 
    apiClient.delete(`/associations/${id}/members/${memberId}`),
};
```

**Tasks** (`lib/api/tasks.ts`):

```typescript
export const tasksApi = {
  list: (associationId: string) => apiClient.get(`/associations/${associationId}/tasks`),
  get: (associationId: string, id: string) => apiClient.get(`/associations/${associationId}/tasks/${id}`),
  create: (associationId: string, data: CreateTaskDto) => 
    apiClient.post(`/associations/${associationId}/tasks`, data),
  update: (associationId: string, id: string, data: UpdateTaskDto) => 
    apiClient.patch(`/associations/${associationId}/tasks/${id}`, data),
  delete: (associationId: string, id: string) => 
    apiClient.delete(`/associations/${associationId}/tasks/${id}`),
  dispute: (associationId: string, id: string) => 
    apiClient.post(`/associations/${associationId}/tasks/${id}/dispute`),
};
```

### Server Component Data Fetching

Server Components fetch directly from API:

```typescript
// Server Component
async function TasksPage({ params }: { params: { id: string } }) {
  const accessToken = await getAccessToken();
  
  const tasks = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/v1/associations/${params.id}/tasks`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store', // Disable caching
    }
  ).then(res => res.json());
  
  return <TasksList tasks={tasks} />;
}
```

## Role-Based UI

### Permissions Library

Location: `apps/web/src/lib/permissions.ts`

**Core Functions**:

```typescript
export function isSystemAdmin(user: AuthenticatedUser): boolean {
  return user.systemRole === 'SYSTEM_ADMIN';
}

export function hasAnyMembership(user: AuthenticatedUser): boolean {
  return user.memberships.length > 0;
}

export function hasRoleInAssociation(
  user: AuthenticatedUser,
  associationId: string,
  roles: UserRole[]
): boolean {
  return user.memberships.some(
    m => m.associationId === associationId && roles.includes(m.role)
  );
}

export function canAccessRoute(
  user: AuthenticatedUser,
  route: 'member' | 'auth' | 'system_admin'
): boolean {
  switch (route) {
    case 'member':
      return hasAnyMembership(user);
    case 'system_admin':
      return isSystemAdmin(user);
    default:
      return true;
  }
}

export function filterNav(
  items: NavItem[],
  user: AuthenticatedUser
): NavItem[] {
  return items.filter(item => {
    if (!item.requiredRole) return true;
    return hasRoleInAssociation(user, item.associationId, item.requiredRole);
  });
}

export function userRoleLabel(user: AuthenticatedUser, associationId?: string): string {
  if (isSystemAdmin(user)) return 'Sistem Yöneticisi';
  
  if (associationId) {
    const membership = user.memberships.find(m => m.associationId === associationId);
    if (membership) {
      switch (membership.role) {
        case 'ASSOCIATION_MANAGER': return 'Başkan';
        case 'ASSOCIATION_SECRETARY': return 'Sekreter';
        case 'ASSOCIATION_MEMBER': return 'Üye';
      }
    }
  }
  
  return 'Üye';
}
```

### UI Usage Examples

**Conditional Rendering**:

```typescript
function AssociationPage({ user, associationId }) {
  const canManageMembers = hasRoleInAssociation(user, associationId, [
    'ASSOCIATION_MANAGER',
    'ASSOCIATION_SECRETARY'
  ]);
  
  return (
    <div>
      <h1>Association Details</h1>
      {canManageMembers && <ManageMembersButton />}
    </div>
  );
}
```

**Navigation Filtering**:

```typescript
function Sidebar({ user }) {
  const navItems = filterNav([
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Tasks', href: '/tasks' },
    { label: 'Members', href: '/members', requiredRole: ['ASSOCIATION_MANAGER', 'ASSOCIATION_SECRETARY'] },
    { label: 'Finance', href: '/finance', requiredRole: ['ASSOCIATION_MANAGER', 'ASSOCIATION_SECRETARY'] },
    { label: 'Admin', href: '/admin', requiredRole: ['SYSTEM_ADMIN'] },
  ], user);
  
  return (
    <nav>
      {navItems.map(item => (
        <Link key={item.href} href={item.href}>{item.label}</Link>
      ))}
    </nav>
  );
}
```

**Role Label Display**:

```typescript
function UserBadge({ user, associationId }) {
  const roleLabel = userRoleLabel(user, associationId);
  
  return (
    <span className="badge">
      {roleLabel}
    </span>
  );
}
```

## Component Architecture

### Server vs Client Components

**Server Components** (default):
- Data fetching from API
- Initial page render
- SEO-critical content

```typescript
// Server Component
export default async function TasksPage({ params }) {
  const tasks = await getTasks(params.id);
  return <TasksList tasks={tasks} />;
}
```

**Client Components** ('use client'):
- Interactive UI
- State management
- Event handlers

```typescript
'use client';

export function TaskCard({ task }) {
  const [isEditing, setIsEditing] = useState(false);
  
  return (
    <div onClick={() => setIsEditing(true)}>
      {task.title}
    </div>
  );
}
```

### Component Organization

```
components/
├── ui/                    # Primitive UI components
│   ├── button.tsx
│   ├── input.tsx
│   ├── modal.tsx
│   └── ...
├── layouts/               # Layout components
│   ├── sidebar.tsx
│   ├── header.tsx
│   └── ...
├── features/              # Feature-specific components
│   ├── tasks/
│   │   ├── task-list.tsx
│   │   ├── task-card.tsx
│   │   └── task-form.tsx
│   ├── members/
│   │   ├── member-list.tsx
│   │   └── member-form.tsx
│   └── ...
└── shared/                # Shared components
    ├── empty-state.tsx
    ├── loading-spinner.tsx
    └── error-boundary.tsx
```

## Styling

### Tailwind CSS

The app uses Tailwind CSS for styling with custom design tokens.

**Configuration** (`tailwind.config.ts`):

```typescript
export default {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#...',
          100: '#...',
          // ...
          900: '#...',
        },
      },
    },
  },
  plugins: [],
};
```

### Global Styles

Location: `apps/web/src/app/globals.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    @apply bg-gray-50 text-gray-900;
  }
}

@layer components {
  .btn-primary {
    @apply bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700;
  }
  
  .card {
    @apply bg-white rounded-lg shadow-sm p-6;
  }
}
```

## State Management

### Server State

Server Components handle data fetching, eliminating need for client-side data fetching libraries.

### Client State

For interactive components:
- `useState` for local state
- `useReducer` for complex state
- Context API for shared state

**Note**: TanStack Query and react-hook-form are not wired up yet.

### Form Handling

Forms use controlled components with React state:

```typescript
'use client';

export function TaskForm({ onSubmit }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ title, description });
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <input value={title} onChange={e => setTitle(e.target.value)} />
      <textarea value={description} onChange={e => setDescription(e.target.value)} />
      <button type="submit">Create</button>
    </form>
  );
}
```

## Error Handling

### API Errors

API errors follow RFC 7807 Problem Details format:

```typescript
class ApiError extends Error {
  status: number;
  type: string;
  detail: string;
  errors?: Record<string, string[]>;
  
  constructor(response: ProblemDetail) {
    super(response.title);
    this.status = response.status;
    this.type = response.type;
    this.detail = response.detail;
    this.errors = response.errors;
  }
}
```

### Error Boundary

```typescript
'use client';

export function ErrorBoundary({ children }: { children: React.ReactNode }) {
  const [error, setError] = useState<Error | null>(null);
  
  if (error) {
    return <ErrorDisplay error={error} onRetry={() => setError(null)} />;
  }
  
  return (
    <React.ErrorBoundary fallback={e => setError(e)}>
      {children}
    </React.ErrorBoundary>
  );
}
```

### Not Found Page

Location: `apps/web/src/app/not-found.tsx`

Custom 404 page with navigation options.

## Performance Optimizations

### Caching Strategy

- Server Components use `cache: 'no-store'` for dynamic data
- Static assets cached via Next.js defaults
- API responses not cached by default

### Code Splitting

- Route-based code splitting via App Router
- Dynamic imports for heavy components:

```typescript
const HeavyComponent = dynamic(() => import('./heavy-component'), {
  loading: () => <LoadingSpinner />,
});
```

### Image Optimization

Next.js Image component for optimized images:

```typescript
import Image from 'next/image';

<Image
  src="/logo.png"
  alt="Logo"
  width={200}
  height={100}
  priority
/>
```

## Testing

### Current State

The web package has **no test harness configured** despite Jest being installed.

**Do NOT run**: `pnpm --filter web test`

### Future Testing Strategy

- Component tests with React Testing Library
- Integration tests for API client
- E2E tests with Playwright (not installed)

## Development Workflow

### Running the App

```bash
pnpm dev:web          # Web only (port 3001)
pnpm dev              # All apps in parallel
```

### Environment Variables

Required in `apps/web/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_API_URL=http://localhost:3000
```

**Important**: Never use `SUPABASE_SERVICE_ROLE_KEY` in web environment.

### TypeScript Configuration

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### Transpiled Packages

Next.js config transpiles shared packages:

```typescript
const nextConfig = {
  transpilePackages: [
    '@ticketbot/shared-types',
    '@ticketbot/shared-validation',
  ],
};
```

## Common Patterns

### Data Fetching in Server Components

```typescript
async function getData(endpoint: string) {
  const token = await getAccessToken();
  
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/v1${endpoint}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    }
  );
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail);
  }
  
  return response.json();
}
```

### Form Submission in Client Components

```typescript
'use client';

export function CreateForm({ associationId }) {
  const [loading, setLoading] = useState(false);
  
  const handleSubmit = async (data: CreateDto) => {
    setLoading(true);
    try {
      await tasksApi.create(associationId, data);
      router.refresh(); // Revalidate server data
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };
  
  return <Form onSubmit={handleSubmit} />;
}
```

### Loading States

```typescript
export default function Loading() {
  return <LoadingSpinner />;
}
```

Create `loading.tsx` in any route for automatic loading state.
