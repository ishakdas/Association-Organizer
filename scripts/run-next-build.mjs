import { spawnSync } from 'node:child_process';
import { buildNextEnvironment } from './next-build-environment.mjs';

const command = process.platform === 'win32' ? 'next.cmd' : 'next';
const result = spawnSync(command, ['build'], {
  stdio: 'inherit',
  env: buildNextEnvironment(process.env),
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
