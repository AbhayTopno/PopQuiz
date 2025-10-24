import type { NextConfig } from 'next';
import { resolve } from 'node:path';

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  /* config options here */
  webpack: (config) => {
    // Ensure path alias "@" -> ./src works in Docker/CI builds as well
    config.resolve = config.resolve || {};
    config.resolve.alias = config.resolve.alias || {};
    // Use explicit node:path resolve to avoid ESM/CJS interop quirks in CI
    config.resolve.alias['@'] = resolve(__dirname, 'src');
    return config;
  },
};

export default nextConfig;
