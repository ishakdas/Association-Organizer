import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { findPotentialSecrets } from './secret-scan.mjs';

const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);
const files = Object.fromEntries(
  tracked.map((file) => {
    try {
      return [file, readFileSync(file, 'utf8')];
    } catch {
      return [file, ''];
    }
  }),
);
const findings = findPotentialSecrets(files);
if (findings.length > 0) {
  for (const finding of findings) process.stderr.write(`${finding.file}:${finding.line}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write('No hardcoded secrets detected\n');
}
