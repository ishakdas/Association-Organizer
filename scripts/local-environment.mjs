const localHosts = new Set(['localhost', '127.0.0.1', '::1', 'host.docker.internal']);

export function parseEnvironment(content) {
  return Object.fromEntries(
    content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const separator = line.indexOf('=');
        const key = line.slice(0, separator);
        const rawValue = line.slice(separator + 1);
        const value = rawValue.replace(/^(["'])(.*)\1$/, '$2');
        return [key, value];
      }),
  );
}

export function buildLocalEnvironment(status) {
  const required = ['API_URL', 'DB_URL', 'ANON_KEY', 'SERVICE_ROLE_KEY', 'JWT_SECRET'];
  const missing = required.filter((key) => !status[key]);
  if (missing.length > 0) throw new Error(`Supabase status is missing: ${missing.join(', ')}`);

  return {
    APP_ENV: 'local',
    NODE_ENV: 'development',
    PORT: '3000',
    DATABASE_URL: status.DB_URL,
    DIRECT_URL: status.DB_URL,
    SUPABASE_URL: status.API_URL,
    SUPABASE_ANON_KEY: status.ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
    SUPABASE_JWT_SECRET: status.JWT_SECRET,
    JWT_SECRET: 'association-organizer-local-bot-jwt-secret',
    AI_API_KEY: '',
    GROQ_API_KEY: '',
    AI_PROVIDER_TYPE: '',
    AI_PROVIDER_BASE_URL: '',
    AI_MODEL: '',
    AI_TEMPERATURE: '',
    AI_MAX_TOKENS: '',
    ENABLE_TELEGRAM_BOT: 'false',
    TELEGRAM_BOT_TOKEN: '',
    TELEGRAM_BOT_USERNAME: 'association_organizer_dev_bot',
    TELEGRAM_WEBHOOK_SECRET: '',
    API_URL: 'http://localhost:3000',
    WEB_URL: 'http://localhost:3001',
    NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: status.ANON_KEY,
    NEXT_PUBLIC_API_URL: 'http://localhost:3000',
    NEXT_PUBLIC_TELEGRAM_BOT_USERNAME: 'association_organizer_dev_bot',
    EMAIL_DELIVERY_MODE: 'mailpit',
    RESEND_API_KEY: '',
    RESEND_FROM_EMAIL: '',
    RESEND_FROM_NAME: 'Dernek Yönetim Sistemi',
    SMTP_HOST: '127.0.0.1',
    SMTP_PORT: '54325',
    MAILPIT_UI_URL: 'http://127.0.0.1:54324',
    ENABLE_JOBS: 'false',
    ENABLE_OVERDUE_CHECKER: 'false',
    LOCAL_ADMIN_EMAIL: 'admin@dev.local',
    LOCAL_ADMIN_PASSWORD: 'LocalAdmin123!',
  };
}

export function serializeEnvironment(environment) {
  return `${Object.entries(environment)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')}\n`;
}

export function isLocalUrl(value) {
  try {
    return localHosts.has(new URL(value).hostname);
  } catch {
    return false;
  }
}

export function assertLocalEnvironment(environment) {
  if (environment.APP_ENV !== 'local') throw new Error('APP_ENV must be local');
  for (const key of ['DATABASE_URL', 'DIRECT_URL', 'SUPABASE_URL', 'API_URL', 'WEB_URL']) {
    if (!isLocalUrl(environment[key])) throw new Error(`${key} must use a local host`);
  }
}
