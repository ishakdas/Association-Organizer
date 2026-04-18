# Roadmap — From Foundation to Production

This document tracks all 62 open issues organized by implementation phase. Each phase must be completed before moving to the next. Issues link to GitHub for full details.

**Repository:** [ishakdas/Association-Organizer](https://github.com/ishakdas/Association-Organizer/issues)

---

## Phase 1 — Core Features (Must Work)

The system is non-functional without these. Implements all stubbed API modules, web pages, and user auth flows.

| # | Issue | Module | Description |
|---|-------|--------|-------------|
| [#1](https://github.com/ishakdas/Association-Organizer/issues/1) | Comments module | API | CRUD endpoints for ticket comments |
| [#2](https://github.com/ishakdas/Association-Organizer/issues/2) | Organisations module | API | CRUD + member invite/management |
| [#3](https://github.com/ishakdas/Association-Organizer/issues/3) | Users module | API | Profile endpoints, telegram status |
| [#4](https://github.com/ishakdas/Association-Organizer/issues/4) | Meeting Notes module | API | CRUD + AI extraction trigger |
| [#5](https://github.com/ishakdas/Association-Organizer/issues/5) | Extensions module | API | Deadline extension request/approve/reject |
| [#6](https://github.com/ishakdas/Association-Organizer/issues/6) | Notifications service | API | Telegram, email, web push delivery |
| [#7](https://github.com/ishakdas/Association-Organizer/issues/7) | BullMQ job queues | API | Reminders, extension SLA, async notifications |
| [#8](https://github.com/ishakdas/Association-Organizer/issues/8) | Ticket detail page | Web | View, comments, status change |
| [#9](https://github.com/ishakdas/Association-Organizer/issues/9) | Create ticket form | Web | Zod-validated form, submit to API |
| [#10](https://github.com/ishakdas/Association-Organizer/issues/10) | Meeting notes page | Web | List, create, AI extraction UI |
| [#11](https://github.com/ishakdas/Association-Organizer/issues/11) | Telegram settings page | Web | Link/unlink Telegram account |
| [#12](https://github.com/ishakdas/Association-Organizer/issues/12) | Organisation management page | Web | Members, roles, settings |
| [#13](https://github.com/ishakdas/Association-Organizer/issues/13) | Organisation selector | Web | Replace hardcoded `organisationId` |
| [#36](https://github.com/ishakdas/Association-Organizer/issues/36) | User registration | Web | Sign-up flow with Supabase Auth |
| [#37](https://github.com/ishakdas/Association-Organizer/issues/37) | Password reset | Web | Forgot password flow |
| [#38](https://github.com/ishakdas/Association-Organizer/issues/38) | Logout | Web | Sign-out button in dashboard |
| [#39](https://github.com/ishakdas/Association-Organizer/issues/39) | Auto-provision User | API | Create User record on first API login |

---

## Phase 2 — Security & Infrastructure (Must Be Safe)

Required before any production deployment. Security hardening, CI/CD, containerization, GDPR.

| # | Issue | Category | Description |
|---|-------|----------|-------------|
| [#20](https://github.com/ishakdas/Association-Organizer/issues/20) | API rate limiting | Security | Fastify rate limiter, per-route limits |
| [#21](https://github.com/ishakdas/Association-Organizer/issues/21) | Webhook secret validation | Security | Validate `X-Telegram-Bot-Api-Secret-Token` |
| [#22](https://github.com/ishakdas/Association-Organizer/issues/22) | Postgres RLS | Security | Row-level security as defense-in-depth |
| [#23](https://github.com/ishakdas/Association-Organizer/issues/23) | Token revocation | Security | Bot JWT blacklist via Redis |
| [#28](https://github.com/ishakdas/Association-Organizer/issues/28) | CI/CD pipeline | Infra | GitHub Actions for lint, test, build |
| [#29](https://github.com/ishakdas/Association-Organizer/issues/29) | Dockerfiles | Infra | Production multi-stage builds |
| [#46](https://github.com/ishakdas/Association-Organizer/issues/46) | Load testing | Infra | k6 performance baselines |
| [#48](https://github.com/ishakdas/Association-Organizer/issues/48) | Connection pooling | Infra | Supabase pooler + `DIRECT_DATABASE_URL` |
| [#58](https://github.com/ishakdas/Association-Organizer/issues/58) | GDPR compliance | Legal | Right to deletion, data export, privacy policy |
| [#59](https://github.com/ishakdas/Association-Organizer/issues/59) | Dependency updates | Infra | Renovate/Dependabot configuration |

---

## Phase 3 — User Experience & Operations (Must Look Good)

Styling, error handling, onboarding, monitoring, backups. Makes the system usable and maintainable.

| # | Issue | Category | Description |
|---|-------|----------|-------------|
| [#27](https://github.com/ishakdas/Association-Organizer/issues/27) | UI styling | Web | Tailwind CSS + shadcn/ui |
| [#33](https://github.com/ishakdas/Association-Organizer/issues/33) | Error boundaries | Web | Loading states, error pages, retry |
| [#40](https://github.com/ishakdas/Association-Organizer/issues/40) | Onboarding flow | Web | Create org or accept invite for new users |
| [#41](https://github.com/ishakdas/Association-Organizer/issues/41) | Monitoring & alerting | Ops | Sentry, log aggregation, alerts |
| [#42](https://github.com/ishakdas/Association-Organizer/issues/42) | Database backups | Ops | Supabase backup config, restore docs |
| [#50](https://github.com/ishakdas/Association-Organizer/issues/50) | Cookie compatibility | Web | Safari ITP, cross-browser Supabase SSR |
| [#55](https://github.com/ishakdas/Association-Organizer/issues/55) | Email provider | API | Resend/SendGrid integration for notifications |

---

## Phase 4 — Hardening & Polish (Should Have)

Testing, code quality, edge case handling, business logic completions.

| # | Issue | Category | Description |
|---|-------|----------|-------------|
| [#14](https://github.com/ishakdas/Association-Organizer/issues/14) | Bot extension flow | Bot | Inline conversation for deadline extensions |
| [#15](https://github.com/ishakdas/Association-Organizer/issues/15) | Bot integration test | Testing | Happy-path test for /start, /link |
| [#16](https://github.com/ishakdas/Association-Organizer/issues/16) | Web integration test | Testing | Login, redirect, tickets render |
| [#17](https://github.com/ishakdas/Association-Organizer/issues/17) | Fix `as any` casts | Tech Debt | FastifyRequest type extensions |
| [#30](https://github.com/ishakdas/Association-Organizer/issues/30) | Health check endpoint | API | `GET /health` with DB/Redis status |
| [#31](https://github.com/ishakdas/Association-Organizer/issues/31) | Soft-delete extension | Database | Prisma client extension for auto-filtering |
| [#32](https://github.com/ishakdas/Association-Organizer/issues/32) | Audit log writes | API | Create AuditLog entries on ticket operations |
| [#47](https://github.com/ishakdas/Association-Organizer/issues/47) | Telegram edge cases | Bot | Rate limits, retries, message size, blocked users |
| [#49](https://github.com/ishakdas/Association-Organizer/issues/49) | Redis memory config | Infra | BullMQ retention, maxmemory, stalled jobs |
| [#51](https://github.com/ishakdas/Association-Organizer/issues/51) | Org deletion strategy | API | Cascade, soft delete, or archive |
| [#52](https://github.com/ishakdas/Association-Organizer/issues/52) | User leaving org | API | Ticket reassignment on member removal |
| [#54](https://github.com/ishakdas/Association-Organizer/issues/54) | File attachments | Feature | Supabase Storage for tickets/notes |
| [#57](https://github.com/ishakdas/Association-Organizer/issues/57) | Data retention | Database | AuditLog/NotificationLog cleanup policy |
| [#61](https://github.com/ishakdas/Association-Organizer/issues/61) | OpenAI API changes | AI | Model config, usage tracking, async extraction |

---

## Phase 5 — Nice to Have (Can Ship Without)

Quality-of-life improvements, future-proofing, optional features.

| # | Issue | Category | Description |
|---|-------|----------|-------------|
| [#18](https://github.com/ishakdas/Association-Organizer/issues/18) | Replace console.log | Tech Debt | Use NestJS Logger everywhere |
| [#19](https://github.com/ishakdas/Association-Organizer/issues/19) | OPENAI_API_KEY in env schema | Tech Debt | Early validation for AI config |
| [#24](https://github.com/ishakdas/Association-Organizer/issues/24) | Bot error logging | Tech Debt | Log errors in /link catch block |
| [#25](https://github.com/ishakdas/Association-Organizer/issues/25) | ExtractedActionItem → Ticket relation | Database | Add Prisma relation |
| [#26](https://github.com/ishakdas/Association-Organizer/issues/26) | Request logging interceptor | API | Structured request/response logging |
| [#34](https://github.com/ishakdas/Association-Organizer/issues/34) | Bot /tickets command | Bot | List assigned tickets in Telegram |
| [#35](https://github.com/ishakdas/Association-Organizer/issues/35) | Populate libs/core | Tech Debt | Shared utilities when needed |
| [#43](https://github.com/ishakdas/Association-Organizer/issues/43) | Accessibility (a11y) | Web | ARIA labels, keyboard nav, screen readers |
| [#44](https://github.com/ishakdas/Association-Organizer/issues/44) | OpenAPI / Swagger docs | API | Auto-generated interactive API docs |
| [#45](https://github.com/ishakdas/Association-Organizer/issues/45) | Token cleanup job | Database | Delete expired TelegramLinkTokens |
| [#53](https://github.com/ishakdas/Association-Organizer/issues/53) | Multi-org visibility | API | Cross-org "My Tickets" view |
| [#56](https://github.com/ishakdas/Association-Organizer/issues/56) | Internationalization (i18n) | Web | Multi-language support |
| [#60](https://github.com/ishakdas/Association-Organizer/issues/60) | Major version upgrades | Maintenance | Node, Next.js, NestJS, Prisma plan |
| [#62](https://github.com/ishakdas/Association-Organizer/issues/62) | Telegram API monitoring | Maintenance | Track Bot API changelog |

---

## Summary

| Phase | Issues | Status | Description |
|-------|--------|--------|-------------|
| **Phase 1** | 17 | Not started | Core features — system non-functional without these |
| **Phase 2** | 10 | Not started | Security & infrastructure — required for production |
| **Phase 3** | 7 | Not started | UX & operations — makes system usable and maintainable |
| **Phase 4** | 14 | Not started | Hardening — edge cases, testing, code quality |
| **Phase 5** | 14 | Not started | Nice to have — polish, future-proofing |
| **Total** | **62** | | |

## How to Track Progress

Filter issues by label on GitHub:
- [All open issues](https://github.com/ishakdas/Association-Organizer/issues)
- [High priority](https://github.com/ishakdas/Association-Organizer/issues?q=is%3Aopen+label%3Apriority%3Ahigh)
- [Security](https://github.com/ishakdas/Association-Organizer/issues?q=is%3Aopen+label%3Asecurity)
- [API module](https://github.com/ishakdas/Association-Organizer/issues?q=is%3Aopen+label%3Amodule%3Aapi)
- [Web module](https://github.com/ishakdas/Association-Organizer/issues?q=is%3Aopen+label%3Amodule%3Aweb)
- [Bot module](https://github.com/ishakdas/Association-Organizer/issues?q=is%3Aopen+label%3Amodule%3Abot)
