import { z } from 'zod';

const localHosts = new Set(['localhost', '127.0.0.1', '::1', 'host.docker.internal']);
const optionalString = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().min(1).optional(),
);
const optionalUrl = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().url().optional(),
);
const optionalEmail = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().email().optional(),
);

function isLocalUrl(value: string): boolean {
  try {
    return localHosts.has(new URL(value).hostname);
  } catch {
    return false;
  }
}

function addIssue(ctx: z.RefinementCtx, path: string, message: string): void {
  ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
}

export const envSchema = z
  .object({
    APP_ENV: z.enum(['local', 'test', 'production']).default('local'),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().default(3000),
    DATABASE_URL: z.string().url(),
    DIRECT_URL: z.string().url(),
    SUPABASE_URL: z.string().url(),
    SUPABASE_ANON_KEY: z.string().min(1),
    SUPABASE_SERVICE_ROLE_KEY: optionalString,
    SUPABASE_JWT_SECRET: z.string().min(32),
    JWT_SECRET: z.string().min(32),
    AI_API_KEY: optionalString,
    GROQ_API_KEY: optionalString,
    AI_PROVIDER_TYPE: optionalString,
    AI_PROVIDER_BASE_URL: optionalUrl,
    AI_MODEL: optionalString,
    AI_TEMPERATURE: optionalString,
    AI_MAX_TOKENS: optionalString,
    ENABLE_TELEGRAM_BOT: z.enum(['true', 'false']).default('false'),
    TELEGRAM_BOT_TOKEN: optionalString,
    TELEGRAM_BOT_USERNAME: z.string().min(1).default('yedi_hilal_organizator_bot'),
    TELEGRAM_WEBHOOK_SECRET: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.string().min(16).optional(),
    ),
    API_URL: z.string().url().default('http://localhost:3000'),
    WEB_URL: z.string().url().default('http://localhost:3001'),
    EMAIL_DELIVERY_MODE: z.enum(['log', 'mailpit', 'resend']).default('log'),
    RESEND_API_KEY: optionalString,
    RESEND_FROM_EMAIL: optionalEmail,
    RESEND_FROM_NAME: z.string().default('Dernek Yönetim Sistemi'),
    SMTP_HOST: z.string().min(1).default('127.0.0.1'),
    SMTP_PORT: z.coerce.number().int().positive().default(54325),
    MAILPIT_UI_URL: z.string().url().default('http://127.0.0.1:54324'),
    ENABLE_JOBS: z.enum(['true', 'false']).default('false'),
    ENABLE_OVERDUE_CHECKER: z.enum(['true', 'false']).default('false'),
  })
  .superRefine((env, ctx) => {
    if (env.APP_ENV === 'local') {
      for (const [key, value] of [
        ['DATABASE_URL', env.DATABASE_URL],
        ['DIRECT_URL', env.DIRECT_URL],
        ['SUPABASE_URL', env.SUPABASE_URL],
        ['API_URL', env.API_URL],
        ['WEB_URL', env.WEB_URL],
      ] as const) {
        if (!isLocalUrl(value)) addIssue(ctx, key, `${key} must use a local host in local mode`);
      }
      if (env.EMAIL_DELIVERY_MODE === 'resend') {
        addIssue(ctx, 'EMAIL_DELIVERY_MODE', 'Local mode cannot send email through Resend');
      }
      if (env.ENABLE_JOBS === 'true' || env.ENABLE_OVERDUE_CHECKER === 'true') {
        addIssue(ctx, 'ENABLE_JOBS', 'Background jobs must remain disabled in local mode');
      }
    }

    if (env.APP_ENV === 'production') {
      if (env.NODE_ENV !== 'production') {
        addIssue(ctx, 'NODE_ENV', 'NODE_ENV must be production when APP_ENV is production');
      }
      for (const [key, value] of [
        ['DATABASE_URL', env.DATABASE_URL],
        ['DIRECT_URL', env.DIRECT_URL],
        ['SUPABASE_URL', env.SUPABASE_URL],
        ['API_URL', env.API_URL],
        ['WEB_URL', env.WEB_URL],
      ] as const) {
        if (isLocalUrl(value)) addIssue(ctx, key, `${key} cannot use a local host in production`);
      }
      for (const [key, value] of [
        ['SUPABASE_URL', env.SUPABASE_URL],
        ['API_URL', env.API_URL],
        ['WEB_URL', env.WEB_URL],
      ] as const) {
        if (!value.startsWith('https://'))
          addIssue(ctx, key, `${key} must use HTTPS in production`);
      }
      if (!env.SUPABASE_SERVICE_ROLE_KEY) {
        addIssue(
          ctx,
          'SUPABASE_SERVICE_ROLE_KEY',
          'SUPABASE_SERVICE_ROLE_KEY is required in production',
        );
      }
      if (env.EMAIL_DELIVERY_MODE === 'mailpit') {
        addIssue(ctx, 'EMAIL_DELIVERY_MODE', 'Production cannot deliver email through Mailpit');
      }
    }

    if (env.ENABLE_TELEGRAM_BOT === 'true' && !env.TELEGRAM_BOT_TOKEN) {
      addIssue(ctx, 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_BOT_TOKEN is required when the bot is enabled');
    }
    if (
      env.APP_ENV === 'production' &&
      env.ENABLE_TELEGRAM_BOT === 'true' &&
      !env.TELEGRAM_WEBHOOK_SECRET
    ) {
      addIssue(ctx, 'TELEGRAM_WEBHOOK_SECRET', 'TELEGRAM_WEBHOOK_SECRET is required in production');
    }
    if (env.EMAIL_DELIVERY_MODE === 'resend') {
      if (!env.RESEND_API_KEY) addIssue(ctx, 'RESEND_API_KEY', 'RESEND_API_KEY is required');
      if (!env.RESEND_FROM_EMAIL)
        addIssue(ctx, 'RESEND_FROM_EMAIL', 'RESEND_FROM_EMAIL is required');
    }
  });

export type Env = z.infer<typeof envSchema>;

export function validateEnv(input: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(input);
  if (result.success) return result.data;

  const errors = result.error.flatten();
  console.error('Environment validation failed:', JSON.stringify(errors, null, 2));
  process.exit(1);
}
