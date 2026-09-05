import { spawnSync } from 'node:child_process';
import { assertLocalEnvironment } from './local-environment.mjs';

assertLocalEnvironment(process.env);

const [command, ...args] = process.argv.slice(2);
if (!command) throw new Error('A command is required');
const result = spawnSync(command, args, { stdio: 'inherit', env: process.env });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
