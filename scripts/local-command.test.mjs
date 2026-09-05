import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const packageJson = JSON.parse(readFileSync(resolve(import.meta.dirname, '../package.json'), 'utf8'));

test('prepares local infrastructure before development starts', () => {
  assert.equal(
    packageJson.scripts.predev,
    'pnpm local:start && pnpm local:env && pnpm db:migrate:local:deploy && pnpm local:auth-seed',
  );
});

test('starts all local services with the optional Telegram profile', () => {
  const command = packageJson.scripts.dev;

  assert.match(command, /\.env\.local/);
  assert.match(command, /\.env\.telegram\.local/);
  assert.match(command, /NX_LOAD_DOT_ENV_FILES=false/);
  assert.equal(packageJson.scripts['dev:telegram'], undefined);
});
