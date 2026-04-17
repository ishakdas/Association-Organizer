import { validateEnv } from './env.validation';

export default () => {
  const env = validateEnv();
  return {
    port: env.PORT,
    nodeEnv: env.NODE_ENV,
    database: { url: env.DATABASE_URL },
    redis: { url: env.REDIS_URL },
    supabase: {
      url: env.SUPABASE_URL,
      anonKey: env.SUPABASE_ANON_KEY,
      jwtSecret: env.SUPABASE_JWT_SECRET,
    },
    jwt: { secret: env.JWT_SECRET },
    bot: { token: env.BOT_TOKEN },
    apiUrl: env.API_URL,
    webUrl: env.WEB_URL,
  };
};
