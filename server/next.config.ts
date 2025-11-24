import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Force Turbopack to treat THIS folder (server/) as the root
  turbopack: {
    root: __dirname,
  },
  // Enable standalone output for Docker
  output: 'standalone',
  // Increase body size limit for large scan data batches
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  // CORS headers for client integration
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization, x-api-key' },
        ],
      },
    ];
  },
};

export default nextConfig;