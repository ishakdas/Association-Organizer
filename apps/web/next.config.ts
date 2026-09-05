import type { NextConfig } from 'next';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';

if (process.env.APP_ENV !== 'production') {
  const environmentFile = path.resolve(__dirname, '../../.env.local');
  if (existsSync(environmentFile)) {
    const nodeEnvironment = process.env.NODE_ENV;
    Object.assign(process.env, parseEnv(readFileSync(environmentFile, 'utf8')));
    if (nodeEnvironment) Object.assign(process.env, { NODE_ENV: nodeEnvironment });
  }
}

const nextConfig: NextConfig = {
  transpilePackages: ['@ticketbot/shared-types', '@ticketbot/shared-validation'],
};

export default nextConfig;
