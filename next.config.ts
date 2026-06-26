import type { NextConfig } from "next";

const backendUrl = process.env.SKILLHUB_BACKEND_URL || "http://127.0.0.1:18001";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  async rewrites() {
    return [
      { source: "/v3/:path*", destination: `${backendUrl}/v3/:path*` },
      { source: "/metrics", destination: `${backendUrl}/metrics` },
      { source: "/healthz", destination: `${backendUrl}/healthz` },
    ];
  },
};

export default nextConfig;
