import * as fs from 'node:fs';
import * as path from 'node:path';

const envPath = path.resolve(__dirname, '../.env.test');
if (!fs.existsSync(envPath)) {
  throw new Error(
    `.env.test not found at ${envPath}. Create it before running e2e tests.`,
  );
}

const content = fs.readFileSync(envPath, 'utf8');
for (const rawLine of content.split('\n')) {
  const line = rawLine.trim();
  if (!line || line.startsWith('#')) continue;
  const eq = line.indexOf('=');
  if (eq === -1) continue;
  const key = line.slice(0, eq).trim();
  let value = line.slice(eq + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  if (process.env[key] === undefined) {
    process.env[key] = value;
  }
}
