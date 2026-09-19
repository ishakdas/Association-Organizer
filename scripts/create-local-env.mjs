import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertLocalEnvironment,
  buildLocalEnvironment,
  parseEnvironment,
  serializeEnvironment,
} from './local-environment.mjs';

const root = resolve(import.meta.dirname, '..');
const output = execFileSync('supabase', ['status', '-o', 'env'], {
  cwd: root,
  encoding: 'utf8',
});
const environment = buildLocalEnvironment(parseEnvironment(output));

// Keep developer-provided integrations when regenerating Supabase values.
// Otherwise every `pnpm local:env` run silently disables AI and Telegram.
const readEnvFile = (filePath) =>
  existsSync(filePath) ? parseEnvironment(readFileSync(filePath, 'utf8')) : {};
const existingLocalEnvironment = readEnvFile(resolve(root, '.env.local'));
const fallbackEnvironment = readEnvFile(resolve(root, '.env'));
const preservedKeys = [
  'AI_API_KEY',
  'GROQ_API_KEY',
  'AI_PROVIDER_TYPE',
  'AI_PROVIDER_BASE_URL',
  'AI_MODEL',
  'AI_TEMPERATURE',
  'AI_MAX_TOKENS',
];

for (const key of preservedKeys) {
  environment[key] =
    existingLocalEnvironment[key] || fallbackEnvironment[key] || environment[key];
}

assertLocalEnvironment(environment);
writeFileSync(resolve(root, '.env.local'), serializeEnvironment(environment), { mode: 0o600 });
process.stdout.write('.env.local created from the local Supabase stack\n');
