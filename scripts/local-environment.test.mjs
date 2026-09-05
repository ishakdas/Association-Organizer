import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertLocalEnvironment,
  buildLocalEnvironment,
  parseEnvironment,
  serializeEnvironment,
} from './local-environment.mjs';

const status = {
  API_URL: 'http://127.0.0.1:54321',
  DB_URL: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
  ANON_KEY: 'anon',
  SERVICE_ROLE_KEY: 'service',
  JWT_SECRET: 'supabase-jwt-secret-at-least-32-characters',
};

test('parses quoted environment output', () => {
  assert.deepEqual(parseEnvironment('API_URL="http://127.0.0.1:54321"\nANON_KEY=anon\n'), {
    API_URL: 'http://127.0.0.1:54321',
    ANON_KEY: 'anon',
  });
});

test('builds an isolated local environment', () => {
  const environment = buildLocalEnvironment(status);

  assertLocalEnvironment(environment);
  assert.equal(environment.ENABLE_TELEGRAM_BOT, 'false');
  assert.equal(environment.ENABLE_JOBS, 'false');
  assert.equal(environment.EMAIL_DELIVERY_MODE, 'mailpit');
  assert.equal(environment.SMTP_HOST, '127.0.0.1');
  assert.equal(environment.SMTP_PORT, '54325');
  assert.equal(environment.NEXT_PUBLIC_SUPABASE_URL, status.API_URL);
  for (const key of [
    'AI_API_KEY',
    'GROQ_API_KEY',
    'TELEGRAM_BOT_TOKEN',
    'TELEGRAM_WEBHOOK_SECRET',
    'RESEND_API_KEY',
    'RESEND_FROM_EMAIL',
  ]) {
    assert.equal(environment[key], '');
  }
});

test('rejects incomplete Supabase status', () => {
  assert.throws(() => buildLocalEnvironment({}), /Supabase status is missing/);
});

test('rejects remote infrastructure in local mode', () => {
  const environment = buildLocalEnvironment(status);
  environment.SUPABASE_URL = 'https://project.supabase.co';

  assert.throws(() => assertLocalEnvironment(environment), /SUPABASE_URL must use a local host/);
});

test('serializes one variable per line', () => {
  assert.equal(
    serializeEnvironment({ APP_ENV: 'local', ENABLE_JOBS: 'false' }),
    'APP_ENV=local\nENABLE_JOBS=false\n',
  );
});
