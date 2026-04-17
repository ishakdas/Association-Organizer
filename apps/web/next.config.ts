import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@ticketbot/shared-types', '@ticketbot/shared-validation'],
};

export default nextConfig;
