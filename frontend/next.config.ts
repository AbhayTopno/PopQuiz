import type { NextConfig } from 'next';
import { resolve } from 'node:path';

// Windows (non-admin) blocks symlinks used by Next standalone output.
// Only enable standalone in CI (e.g., Vercel) or when explicitly opted in.
const shouldUseStandalone = process.env.CI === 'true' || process.env.NEXT_STANDALONE === 'true';

const nextConfig: NextConfig = {
  output: shouldUseStandalone ? 'standalone' : undefined,
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
