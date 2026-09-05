import * as path from 'node:path';
import { resolveAppEnvironment, resolveEnvironmentFile } from './environment-file';

describe('environment file selection', () => {
  const root = path.resolve('/workspace');

  it('uses the local environment by default', () => {
    expect(resolveAppEnvironment('', '')).toBe('local');
    expect(resolveEnvironmentFile(root, '', '')).toBe(path.resolve(root, '.env.local'));
  });

  it('uses the test environment when tests run', () => {
    expect(resolveAppEnvironment(undefined, 'test')).toBe('test');
    expect(resolveEnvironmentFile(root, undefined, 'test')).toBe(path.resolve(root, '.env.test'));
  });

  it('does not load a file in production', () => {
    expect(resolveAppEnvironment('production', 'development')).toBe('production');
    expect(resolveEnvironmentFile(root, 'production', 'development')).toBeNull();
  });

  it('treats NODE_ENV production as production when APP_ENV is missing', () => {
    expect(resolveAppEnvironment(undefined, 'production')).toBe('production');
    expect(resolveEnvironmentFile(root, undefined, 'production')).toBeNull();
  });
});
