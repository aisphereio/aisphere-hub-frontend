import type { NextConfig } from "next";

/**
 * Next.js config — NO API rewrites.
 *
 * The frontend talks DIRECTLY to the hub backend. The hub URL is
 * configured via NEXT_PUBLIC_HUB_URL (defaults to http://127.0.0.1:18001
 * for local dev). In production, set NEXT_PUBLIC_HUB_URL to the public
 * hub URL (e.g. https://hub.example.com) and configure CORS on the hub
 * side to allow the frontend origin.
 *
 * Why no rewrites:
 *
 *   1. Performance — every API call going through Next.js Node process
 *      adds latency and memory pressure. Direct browser → hub is one
 *      hop fewer.
 *
 *   2. SSR correctness — Next.js rewrites do NOT transparently forward
 *      Authorization headers to server-side fetch, so SSR data fetching
 *      with Bearer tokens breaks silently.
 *
 *   3. Dev experience — when the hub is down, the frontend sees a
 *      direct network error instead of a confusing 500 from Next.js's
 *      rewrite proxy.
 *
 *   4. Production simplicity — no need to co-locate Next.js and hub on
 *      the same origin. CORS on the hub handles cross-origin.
 *
 * If you need same-origin in production (e.g. to avoid CORS), put a
 * real reverse proxy (Caddy / nginx) in front that routes /v1/* to
 * hub and /* to Next.js — that is one hop, not two.
 */
const hubUrl = process.env.NEXT_PUBLIC_HUB_URL || "http://127.0.0.1:18001";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // NO rewrites — frontend talks directly to hub via NEXT_PUBLIC_HUB_URL.
  // The hub must have CORS enabled for the frontend origin.
  env: {
    NEXT_PUBLIC_HUB_URL: hubUrl,
  },
};

export default nextConfig;
