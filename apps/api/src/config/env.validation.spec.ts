import { envSchema } from './env.validation';

const base = {
  APP_ENV: 'local',
  NODE_ENV: 'development',
  DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
  DIRECT_URL: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
  SUPABASE_URL: 'http://127.0.0.1:54321',
  SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  SUPABASE_JWT_SECRET: 'local-supabase-jwt-secret-at-least-32-characters',
  JWT_SECRET: 'local-bot-jwt-secret-at-least-32-characters',
  API_URL: 'http://localhost:3000',
  WEB_URL: 'http://localhost:3001',
};

describe('environment validation', () => {
  it('accepts an isolated local environment', () => {
    expect(envSchema.parse({ ...base, TELEGRAM_BOT_TOKEN: '', RESEND_API_KEY: '' })).toMatchObject({
      APP_ENV: 'local',
      ENABLE_TELEGRAM_BOT: 'false',
      ENABLE_JOBS: 'false',
      EMAIL_DELIVERY_MODE: 'log',
      TELEGRAM_BOT_TOKEN: undefined,
      RESEND_API_KEY: undefined,
    });
  });

  it('rejects a remote Supabase project in local mode', () => {
    expect(() => envSchema.parse({ ...base, SUPABASE_URL: 'https://project.supabase.co' })).toThrow(
      'SUPABASE_URL must use a local host in local mode',
    );
  });

  it('rejects outbound services in local mode', () => {
    expect(() =>
      envSchema.parse({
        ...base,
        ENABLE_TELEGRAM_BOT: 'true',
        TELEGRAM_BOT_TOKEN: 'token',
        EMAIL_DELIVERY_MODE: 'resend',
        RESEND_API_KEY: 'key',
        RESEND_FROM_EMAIL: 'mail@example.com',
      }),
    ).toThrow('Local mode cannot send email through Resend');
  });

  it('accepts Mailpit delivery in local mode', () => {
    expect(envSchema.parse({ ...base, EMAIL_DELIVERY_MODE: 'mailpit' })).toMatchObject({
      EMAIL_DELIVERY_MODE: 'mailpit',
      SMTP_HOST: '127.0.0.1',
      SMTP_PORT: 54325,
      MAILPIT_UI_URL: 'http://127.0.0.1:54324',
    });
  });

  it('accepts an isolated Telegram bot in local mode', () => {
    expect(
      envSchema.parse({
        ...base,
        ENABLE_TELEGRAM_BOT: 'true',
        TELEGRAM_BOT_TOKEN: 'local-test-bot-token',
      }),
    ).toMatchObject({
      APP_ENV: 'local',
      ENABLE_TELEGRAM_BOT: 'true',
      TELEGRAM_BOT_TOKEN: 'local-test-bot-token',
    });
  });

  it('accepts a complete production environment', () => {
    expect(
      envSchema.parse({
        ...base,
        APP_ENV: 'production',
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://user:pass@db.example.com:6543/app',
        DIRECT_URL: 'postgresql://user:pass@db.example.com:5432/app',
        SUPABASE_URL: 'https://project.supabase.co',
        API_URL: 'https://api.example.com',
        WEB_URL: 'https://app.example.com',
        ENABLE_TELEGRAM_BOT: 'true',
        TELEGRAM_BOT_TOKEN: 'token',
        TELEGRAM_WEBHOOK_SECRET: 'webhook-secret-at-least-16',
      }),
    ).toMatchObject({ APP_ENV: 'production', NODE_ENV: 'production' });
  });

  it('rejects local infrastructure in production', () => {
    expect(() =>
      envSchema.parse({ ...base, APP_ENV: 'production', NODE_ENV: 'production' }),
    ).toThrow('DATABASE_URL cannot use a local host in production');
  });
});
