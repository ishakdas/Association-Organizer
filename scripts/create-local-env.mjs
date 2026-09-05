import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
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
assertLocalEnvironment(environment);
writeFileSync(resolve(root, '.env.local'), serializeEnvironment(environment), { mode: 0o600 });
process.stdout.write('.env.local created from the local Supabase stack\n');
