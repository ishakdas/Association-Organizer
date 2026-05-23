# Deployment & Infrastructure

## Overview

The Association Organizer system is deployed across multiple platforms:
- **API + Bot**: Railway
- **Web**: Vercel
- **Database**: Supabase (PostgreSQL)
- **Cache/Queue**: Redis (Railway)

## Infrastructure Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      End Users                               │
├──────────────────────────┬──────────────────────────────────┤
│   Web App (Vercel)       │   Telegram (Mobile)              │
│   https://app.domain.com │   Telegram Bot                   │
└────────────┬─────────────┴──────────────┬───────────────────┘
             │                            │
             │ HTTPS                      │ HTTPS
             │                            │
┌────────────▼────────────────────────────▼───────────────────┐
│                   API (Railway)                              │
│                   https://api.domain.com                     │
│                   Port: 3000                                 │
├──────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────────────────────────┐     │
│  │  HTTP Server │  │  Telegram Bot (Webhook Handler)  │     │
│  │  (Fastify)   │  │  /telegram/webhook               │     │
│  └──────────────┘  └──────────────────────────────────┘     │
└────────────┬─────────────────────────────────┬──────────────┘
             │                                  │
┌────────────▼──────────────┐  ┌───────────────▼──────────────┐
│  Supabase (PostgreSQL)    │  │  Redis (Railway)             │
│  Database + Auth          │  │  BullMQ (future)             │
└───────────────────────────┘  └──────────────────────────────┘
```

## Deployment Platforms

### Railway (API + Bot)

**Configuration**: `railway.json`

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "pnpm install && pnpm build"
  },
  "deploy": {
    "startCommand": "pnpm db:migrate:deploy && pnpm db:generate && node dist/apps/api/main.js",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

**Deploy Steps**:
1. Connect GitHub repository to Railway
2. Set environment variables
3. Deploy automatically on push to main

**Environment Variables** (Railway dashboard):

```env
NODE_ENV=production
DATABASE_URL=${DATABASE_URL}
REDIS_URL=${REDIS_URL}

SUPABASE_URL=${SUPABASE_URL}
SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
SUPABASE_JWT_SECRET=${SUPABASE_JWT_SECRET}

JWT_SECRET=${JWT_SECRET}
BOT_TOKEN=${BOT_TOKEN}

API_URL=https://api.domain.com
WEB_URL=https://app.domain.com
```

### Vercel (Web)

**Configuration**: `next.config.ts`

```typescript
const nextConfig = {
  output: 'standalone',
  transpilePackages: [
    '@ticketbot/shared-types',
    '@ticketbot/shared-validation',
  ],
  images: {
    domains: ['avatars.githubusercontent.com', 'supabase.co'],
  },
};

export default nextConfig;
```

**Deploy Steps**:
1. Connect GitHub repository to Vercel
2. Set root directory to `apps/web`
3. Set environment variables
4. Deploy automatically on push to main

**Environment Variables** (Vercel dashboard):

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_URL=https://api.domain.com
```

### Supabase (Database + Auth)

**Database**:
- PostgreSQL 15+
- Managed by Supabase
- Connection string in `DATABASE_URL`

**Auth**:
- Supabase Auth for web users
- JWT secret in `SUPABASE_JWT_SECRET`
- Service role key for admin operations

**Setup**:
1. Create Supabase project
2. Get credentials from Settings → API
3. Configure auth providers (email, OAuth)
4. Set up database schema via Prisma migrations

### Redis (Railway)

**Purpose**:
- BullMQ job queue (future)
- Session caching (optional)
- Rate limiting (optional)

**Setup**:
1. Create Redis service in Railway
2. Get connection URL
3. Set `REDIS_URL` environment variable

## Docker Deployment

### Dockerfile

```dockerfile
# Builder stage
FROM node:20-alpine AS builder
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.29.3 --activate

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY apps/bot/package.json ./apps/bot/
COPY libs/database/package.json ./libs/database/
COPY libs/shared-types/package.json ./libs/shared-types/
COPY libs/shared-validation/package.json ./libs/shared-validation/
COPY libs/core/package.json ./libs/core/
COPY libs/ai/package.json ./libs/ai/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Generate Prisma client and build
RUN pnpm db:generate
RUN pnpm build

# Production stage
FROM node:20-alpine AS runner
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.29.3 --activate

# Copy necessary files
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/libs/database ./libs/database
COPY --from=builder /app/node_modules ./node_modules

# Set environment
ENV NODE_ENV=production

# Expose port
EXPOSE 3000

# Run migrations and start
CMD ["sh", "-c", "pnpm db:migrate:deploy && node apps/api/dist/main.js"]
```

### Docker Compose (Production)

```yaml
version: '3.8'

services:
  api:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/association_organizer
      - REDIS_URL=redis://redis:6379
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
      - SUPABASE_JWT_SECRET=${SUPABASE_JWT_SECRET}
      - JWT_SECRET=${JWT_SECRET}
      - BOT_TOKEN=${BOT_TOKEN}
      - API_URL=https://api.domain.com
      - WEB_URL=https://app.domain.com
    depends_on:
      - db
      - redis
    restart: unless-stopped

  web:
    build:
      context: .
      dockerfile: Dockerfile.web
    ports:
      - "3001:3001"
    environment:
      - NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_URL}
      - NEXT_PUBLIC_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
      - NEXT_PUBLIC_API_URL=https://api.domain.com
    depends_on:
      - api
    restart: unless-stopped

  db:
    image: postgres:16
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=association_organizer
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

## CI/CD

### GitHub Actions (Future)

No GitHub Actions workflows currently configured. Recommended setup:

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test_db
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v4
      
      - uses: pnpm/action-setup@v2
        with:
          version: 10.29.3
      
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Generate Prisma client
        run: pnpm db:generate
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
      
      - name: Run migrations
        run: pnpm db:migrate
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
      
      - name: Run linter
        run: pnpm lint
      
      - name: Run tests
        run: pnpm test
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
          JWT_SECRET: test-secret
          SUPABASE_JWT_SECRET: test-jwt-secret
```

### Deployment Pipeline

```
Push to main
  → GitHub Actions (CI)
    → Lint
    → Typecheck
    → Test
    → Build
  → Railway (API)
    → Auto-deploy from main
    → Run migrations
    → Start server
  → Vercel (Web)
    → Auto-deploy from main
    → Build Next.js
    → Deploy to edge network
```

## Environment Management

### Environment Files

**Development**:
- `apps/api/.env`
- `apps/web/.env.local`

**Production**:
- Railway dashboard (API)
- Vercel dashboard (Web)

### Environment Validation

API validates environment on boot via Zod:

```typescript
// apps/api/src/config/env.validation.ts
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string(),
  SUPABASE_SERVICE_ROLE_KEY: z.string(),
  SUPABASE_JWT_SECRET: z.string(),
  JWT_SECRET: z.string(),
  BOT_TOKEN: z.string(),
  API_URL: z.string().url(),
  WEB_URL: z.string().url(),
});

export function validateEnv(config: Record<string, unknown>) {
  return envSchema.parse(config);
}
```

Invalid environment causes process to exit.

### Secret Management

**Never commit**:
- `.env` files
- Service role keys
- JWT secrets
- Bot tokens

**Use**:
- Railway environment variables
- Vercel environment variables
- Supabase dashboard for DB credentials
- GitHub Secrets for CI/CD

## Monitoring

### Health Checks

**Endpoints**:
- `GET /health` - Basic health check
- `GET /health/ready` - Readiness probe
- `GET /health/alive` - Liveness probe

**Railway Health Check**:
- Configure in Railway dashboard
- Path: `/health`
- Interval: 30 seconds

### Logging

**API Logging**:

```typescript
import { Logger } from '@nestjs/common';

const logger = new Logger(AppModule.name);

logger.log('Application started');
logger.error('Error occurred', stackTrace);
```

**Railway Logs**:
- View in Railway dashboard
- Filter by deployment
- Download logs

**Vercel Logs**:
- View in Vercel dashboard
- Real-time log streaming

### Error Tracking

**Future Integration**:
- Sentry for error tracking
- LogRocket for session replay
- Datadog for APM

## Scaling

### Current Architecture

- Single API instance (Railway)
- Single web instance (Vercel)
- Managed PostgreSQL (Supabase)
- Single Redis instance (Railway)

### Scaling Strategies

**Horizontal Scaling**:
- Railway: Enable multiple instances
- Vercel: Automatic edge network scaling
- Database: Supabase read replicas

**Vertical Scaling**:
- Railway: Increase instance size
- Database: Supabase compute add-ons

**Caching**:
- Redis for session caching
- Redis for API response caching
- CDN for static assets (Vercel)

**Database Optimization**:
- Add indexes for frequent queries
- Use connection pooling (Supabase)
- Archive old data

## Backup & Recovery

### Database Backups

**Supabase**:
- Automatic daily backups
- Point-in-time recovery
- Manual backups via dashboard

**Manual Backup**:

```bash
pg_dump -h db.host.supabase.co -U postgres -d postgres > backup.sql
```

**Restore**:

```bash
psql -h db.host.supabase.co -U postgres -d postgres < backup.sql
```

### Environment Backups

- Export environment variables from Railway/Vercel dashboards
- Store securely in password manager
- Document required variables

## Security

### Network Security

- HTTPS everywhere (enforced by platforms)
- CORS configured in API
- Rate limiting (future)

### Application Security

- Environment validation on boot
- JWT authentication
- Role-based authorization
- Input validation via Zod
- SQL injection prevention (Prisma)

### Data Security

- `SUPABASE_SERVICE_ROLE_KEY` backend-only
- Passwords hashed by Supabase Auth
- Sensitive data encrypted at rest (Supabase)
- Soft delete for data retention

### Best Practices

1. **Rotate secrets regularly**
2. **Use strong JWT secrets**
3. **Enable Supabase 2FA**
4. **Monitor error logs**
5. **Keep dependencies updated**
6. **Review access permissions**

## Domain Configuration

### Custom Domains

**API (Railway)**:
1. Add custom domain in Railway dashboard
2. Configure DNS CNAME record
3. Wait for SSL certificate

**Web (Vercel)**:
1. Add custom domain in Vercel dashboard
2. Configure DNS A/CNAME records
3. Wait for SSL certificate

### DNS Records

```
# API
api.domain.com.  CNAME  api.railway.app.

# Web
app.domain.com.  CNAME  cname.vercel-dns.com.
domain.com.      A      76.76.21.21
```

## Troubleshooting

### Common Issues

**API Not Starting**:
- Check environment variables
- Check database connection
- Check migration status
- View Railway logs

**Web Build Failing**:
- Check `NEXT_PUBLIC_*` variables
- Check transpilePackages config
- View Vercel build logs

**Database Connection Issues**:
- Check `DATABASE_URL` format
- Check Supabase project status
- Check connection pool settings

**Bot Not Responding**:
- Check `BOT_TOKEN` is correct
- Check webhook URL is set
- Check `/telegram/webhook` endpoint

### Debug Commands

```bash
# Check API health
curl https://api.domain.com/health

# Check database connection
pnpm db:studio

# View Railway logs
railway logs

# View Vercel logs
vercel logs

# Test bot webhook
curl -X POST https://api.domain.com/telegram/webhook \
  -H "Content-Type: application/json" \
  -d '{"update_id": 1, "message": {"text": "/start"}}'
```

## Cost Estimation

### Free Tier

- **Railway**: $5 credit/month (trial)
- **Vercel**: Hobby tier (free for personal projects)
- **Supabase**: Free tier (500MB database, 2 projects)
- **Redis**: Railway Redis (small instance)

### Production Tier

- **Railway**: ~$20-50/month (depending on usage)
- **Vercel**: Pro tier ($20/month)
- **Supabase**: Pro tier ($25/month)
- **Redis**: ~$10/month

**Total**: ~$75-105/month

## Future Infrastructure

### Planned Additions

1. **CDN**: Cloudflare for caching and DDoS protection
2. **Monitoring**: Sentry for error tracking
3. **Analytics**: PostHog for user analytics
4. **Email**: Resend/SendGrid for email notifications
5. **Object Storage**: Supabase Storage for receipts/images
6. **Search**: Meilisearch/Algolia for full-text search
7. **CI/CD**: GitHub Actions for automated testing
8. **Staging**: Separate staging environment

### Migration Path

**Current** → **Future**:
- Railway → Kubernetes (if needed)
- Supabase → Self-hosted PostgreSQL (if needed)
- Vercel → Self-hosted Next.js (if needed)
