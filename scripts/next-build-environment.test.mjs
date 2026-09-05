import test from 'node:test';
import assert from 'node:assert/strict';
import { buildNextEnvironment } from './next-build-environment.mjs';

test('forces Next production semantics without changing the app environment', () => {
  const environment = buildNextEnvironment({ NODE_ENV: 'development', APP_ENV: 'local' });

  assert.equal(environment.NODE_ENV, 'production');
  assert.equal(environment.APP_ENV, 'local');
});
