import * as path from 'node:path';

export type AppEnvironment = 'local' | 'test' | 'production';

export function resolveAppEnvironment(
  appEnv = process.env.APP_ENV,
  nodeEnv = process.env.NODE_ENV,
): AppEnvironment {
  if (appEnv === 'production' || nodeEnv === 'production') return 'production';
  if (appEnv === 'test' || nodeEnv === 'test') return 'test';
  return 'local';
}

export function resolveEnvironmentFile(
  workspaceRoot: string,
  appEnv = process.env.APP_ENV,
  nodeEnv = process.env.NODE_ENV,
): string | null {
  const environment = resolveAppEnvironment(appEnv, nodeEnv);
  if (environment === 'production') return null;
  return path.resolve(workspaceRoot, environment === 'test' ? '.env.test' : '.env.local');
}
