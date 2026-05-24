import { validateEnv } from './env.validation';

export default () => {
  const env = validateEnv();
  return {
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
    bot: { token: env.TELEGRAM_BOT_TOKEN },
    telegramBotUsername: env.TELEGRAM_BOT_USERNAME,
    apiUrl: env.API_URL,
    webUrl: env.WEB_URL,
    resend: {
      apiKey: env.RESEND_API_KEY ?? null,
      fromEmail: env.RESEND_FROM_EMAIL ?? null,
      fromName: env.RESEND_FROM_NAME,
    },
  };
};
