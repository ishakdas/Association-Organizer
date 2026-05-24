import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  // Direct (non-pooled) Postgres URL — required by Prisma migrate and
  // pg-boss (advisory locks + LISTEN/NOTIFY don't survive PgBouncer txn
  // mode). Falls back to DATABASE_URL for local dev where there's only one.
  DIRECT_URL: z.string().url().optional(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  SUPABASE_JWT_SECRET: z.string().min(1),
  JWT_SECRET: z.string().min(1),
  // Optional — AiModule logs a warning and AI-dependent endpoints
  // return 503 when this is missing, so the rest of the API still boots.
  // AI_API_KEY is the primary; GROQ_API_KEY is kept for backward compatibility.
  AI_API_KEY: z.string().min(1).optional(),
  GROQ_API_KEY: z.string().min(1).optional(),
  AI_PROVIDER_TYPE: z.string().min(1).optional(),
  AI_PROVIDER_BASE_URL: z.string().url().optional(),
  AI_MODEL: z.string().min(1).optional(),
  AI_TEMPERATURE: z.string().min(1).optional(),
  AI_MAX_TOKENS: z.string().min(1).optional(),
  BOT_TOKEN: z.string().min(1),
  TELEGRAM_BOT_USERNAME: z.string().min(1).default('yedi_hilal_organizator_bot'),
  API_URL: z.string().url().default('http://localhost:3000'),
  WEB_URL: z.string().url().default('http://localhost:3001'),
  // ─── Resend (email delivery — magic link, telegram link, etc.) ─────
  // Free tier: 3,000 emails/month. API key from https://resend.com
  RESEND_API_KEY: z.string().min(1).optional(),
  RESEND_FROM_EMAIL: z.string().email().optional(),
  RESEND_FROM_NAME: z.string().default('Dernek Yönetim Sistemi'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Invalid environment variables:', result.error.flatten().fieldErrors);
    process.exit(1);
  }
  return result.data;
}
