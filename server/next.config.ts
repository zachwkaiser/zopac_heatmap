import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Force Turbopack to treat THIS folder (server/) as the root
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;