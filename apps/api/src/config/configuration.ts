import { validateEnv } from './env.validation';

export default () => {
  const env = validateEnv();
  return {
    environment: env.APP_ENV,
    port: env.PORT,
    nodeEnv: env.NODE_ENV,
    database: { url: env.DATABASE_URL, directUrl: env.DIRECT_URL ?? null },
    supabase: {
      url: env.SUPABASE_URL,
      anonKey: env.SUPABASE_ANON_KEY,
      serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY ?? null,
      jwtSecret: env.SUPABASE_JWT_SECRET,
    },
    jwt: { secret: env.JWT_SECRET },
    bot: {
      enabled: env.ENABLE_TELEGRAM_BOT === 'true',
      token: env.TELEGRAM_BOT_TOKEN,
      webhookSecret: env.TELEGRAM_WEBHOOK_SECRET ?? null,
    },
    telegramBotUsername: env.TELEGRAM_BOT_USERNAME,
    apiUrl: env.API_URL,
    webUrl: env.WEB_URL,
    resend: {
      mode: env.EMAIL_DELIVERY_MODE,
      apiKey: env.RESEND_API_KEY ?? null,
      fromEmail: env.RESEND_FROM_EMAIL ?? null,
      fromName: env.RESEND_FROM_NAME,
    },
    smtp: {
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      previewUrl: env.MAILPIT_UI_URL,
    },
    jobs: {
      enabled: env.ENABLE_JOBS === 'true',
      overdueCheckerEnabled: env.ENABLE_OVERDUE_CHECKER === 'true',
    },
  };
};
