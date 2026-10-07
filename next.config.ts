import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // ~200 pages prerender against Neon's HTTP driver; an occasional dropped
    // fetch should retry rather than fail the deploy.
    staticGenerationRetryCount: 2,
    staticGenerationMaxConcurrency: 4,
  },
  images: {
    // DummyJSON already serves small WebP files; serving them as-is keeps us
    // clear of Vercel Hobby's image-optimization quota (owner decision).
    unoptimized: true,
    remotePatterns: [new URL("https://cdn.dummyjson.com/product-images/**")],
  },
};

export default nextConfig;
