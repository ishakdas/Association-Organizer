import test from 'node:test';
import assert from 'node:assert/strict';
import { findPotentialSecrets } from './secret-scan.mjs';

test('finds a hardcoded service role token', () => {
  const token = ['eyJheader', 'eyJpayload', 'signature'].join('.');
  const findings = findPotentialSecrets({ 'unsafe.js': `const key = '${token}'` });
  assert.deepEqual(findings, [{ file: 'unsafe.js', line: 1 }]);
});

test('accepts environment variable reads and templates', () => {
  const findings = findPotentialSecrets({
    'safe.ts': 'const key = process.env.SUPABASE_SERVICE_ROLE_KEY',
    '.env.example': 'SUPABASE_SERVICE_ROLE_KEY=',
  });
  assert.deepEqual(findings, []);
});
