# Deployment Guide

## Architecture Overview

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Vercel      │     │   Railway     │     │   Supabase    │
│               │     │               │     │               │
│  Next.js Web  │────▶│  NestJS API   │────▶│  PostgreSQL   │
│  (Dashboard)  │     │  + Bot Webhook│     │  (Database)   │
│               │     │               │     │               │
│  Port: 443    │     │  Port: 3000   │     │  Port: 5432   │
└──────────────┘     │               │     │               │
                      │  Redis (jobs) │     │  Supabase Auth│
                      │  Port: 6379   │     │  (JWT issuer) │
                      └──────────────┘     └──────────────┘
                             ▲
                             │
                      ┌──────────────┐
                      │   Telegram    │
                      │   Servers     │
                      │               │
                      │  POST /telegram│
                      │  /webhook     │
                      └──────────────┘
```

## Supabase Setup

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note down from **Settings → API**:
   - `Project URL` → `SUPABASE_URL`
   - `anon public key` → `SUPABASE_ANON_KEY`
   - `JWT Secret` → `SUPABASE_JWT_SECRET`

### 2. Database Connection

From **Settings → Database**:
- Copy the **Connection string (URI)** → `DATABASE_URL`
- Use the "Transaction" pooler for API connections in production

### 3. Authentication

Supabase Auth is pre-configured. The API verifies Supabase-issued JWTs using the JWT secret (symmetric HS256).

To create users for testing:
- Go to **Authentication → Users** in the Supabase dashboard
- Or use the Supabase client library: `supabase.auth.signUp({ email, password })`

**Important:** After creating a Supabase Auth user, you must also create a corresponding `User` record in the database with the `supabaseId` matching the Supabase Auth user's `id`.

## Railway Setup (API + Redis)

### 1. Create a Railway Project

1. Go to [railway.app](https://railway.app) and create a new project
2. Connect your GitHub repository

### 2. Add Redis

1. Click **"New"** → **"Database"** → **"Redis"**
2. Railway provides `REDIS_URL` automatically

### 3. Deploy the API

1. Click **"New"** → **"GitHub Repo"** → select the repo
2. Configure the service:

**Build settings:**
```
Root Directory: /
Build Command: pnpm install --frozen-lockfile && pnpm db:generate && pnpm --filter api build
Start Command: node apps/api/dist/main.js
```

**Environment variables:**
```
NODE_ENV=production
PORT=3000
DATABASE_URL=<from Supabase>
REDIS_URL=<from Railway Redis>
SUPABASE_URL=<from Supabase>
SUPABASE_ANON_KEY=<from Supabase>
SUPABASE_JWT_SECRET=<from Supabase>
JWT_SECRET=<generate: openssl rand -base64 32>
BOT_TOKEN=<from @BotFather>
API_URL=https://<your-railway-domain>
WEB_URL=https://<your-vercel-domain>
OPENAI_API_KEY=<from OpenAI>
```

### 4. Run Migrations

After the first deploy, run migrations via Railway's shell:
```bash
npx prisma migrate deploy --schema=libs/database/prisma/schema.prisma
```

Or set up a one-time deploy command:
```bash
pnpm db:generate && npx prisma migrate deploy --schema=libs/database/prisma/schema.prisma
```

### 5. Set Telegram Webhook

The API automatically sets the webhook on startup using `API_URL`. Verify it:
```bash
curl https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo
```

Expected response should show `url: "https://<your-railway-domain>/telegram/webhook"`.

## Vercel Setup (Web Dashboard)

### 1. Import Project

1. Go to [vercel.com](https://vercel.com) and import the GitHub repo
2. Configure:

**Framework Preset:** Next.js
**Root Directory:** `apps/web`
**Build Command:** `cd ../.. && pnpm install --frozen-lockfile && pnpm --filter web build`
**Output Directory:** `.next`
**Install Command:** (leave empty — handled by build command)

### 2. Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=<from Supabase>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from Supabase>
NEXT_PUBLIC_API_URL=https://<your-railway-domain>
```

### 3. CORS

Ensure the API's `WEB_URL` env var matches the Vercel domain exactly (e.g., `https://your-app.vercel.app`). The API enables CORS for this origin.

## Telegram Bot Setup

### 1. Create the Bot

1. Message [@BotFather](https://t.me/BotFather) on Telegram
2. Send `/newbot` and follow the prompts
3. Save the bot token → `BOT_TOKEN`

### 2. Configure Bot Commands

Send to @BotFather:
```
/setcommands
```
Then provide:
```
start - Welcome and setup instructions
link - Link your Telegram account
help - Show available commands
```

### 3. Webhook Verification

The API sets the webhook automatically. If you need to set it manually:
```bash
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://<API_URL>/telegram/webhook"}'
```

## Production Checklist

### Security
- [ ] `JWT_SECRET` is unique, random, and at least 32 characters
- [ ] `SUPABASE_JWT_SECRET` matches the Supabase project's JWT secret
- [ ] No `.env` files committed to git (check `.gitignore`)
- [ ] API CORS origin is set to the exact Vercel domain
- [ ] Supabase RLS policies are considered for future hardening (not in v1)

### Database
- [ ] All migrations are applied (`prisma migrate deploy`)
- [ ] Connection pooling is enabled in Supabase (use Transaction pooler URL)
- [ ] Seed data is NOT applied in production (only in dev)

### Monitoring
- [ ] Railway logs are accessible (JSON format via pino)
- [ ] Vercel deployment logs are monitored
- [ ] Supabase dashboard shows active connections

### Performance
- [ ] Redis is provisioned with enough memory for BullMQ jobs
- [ ] PostgreSQL has adequate compute for expected load
- [ ] Next.js static pages are cached by Vercel CDN

## Environment Variables Reference

| Variable | Required | Used By | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | No | API | `development`, `production`, or `test` (default: `development`) |
| `PORT` | No | API | API server port (default: `3000`) |
| `DATABASE_URL` | Yes | API, Database | PostgreSQL connection string |
| `REDIS_URL` | Yes | API | Redis connection string for BullMQ |
| `SUPABASE_URL` | Yes | API, Web | Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | API, Web | Supabase anonymous/public key |
| `SUPABASE_JWT_SECRET` | Yes | API | Supabase JWT signing secret (for token verification) |
| `JWT_SECRET` | Yes | API | Secret for signing bot session tokens (HS256) |
| `BOT_TOKEN` | Yes | API | Telegram bot token from @BotFather |
| `API_URL` | Yes | API | Public URL of the API (for webhook registration) |
| `WEB_URL` | Yes | API | Public URL of the web dashboard (for CORS and bot messages) |
| `OPENAI_API_KEY` | Yes | API | OpenAI API key for AI extraction |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Web | Supabase URL (client-side) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Web | Supabase anon key (client-side) |
| `NEXT_PUBLIC_API_URL` | Yes | Web | API URL for client-side fetches |
