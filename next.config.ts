import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  experimental: {
    // Explicitly disable Babel
    forceSwcTransforms: true
  }
};

export default nextConfig;
