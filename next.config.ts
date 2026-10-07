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
    // Product images are small WebP files mirrored into public/product-images
    // (owner decision); served as-is, which also keeps us clear of Vercel
    // Hobby's image-optimization quota.
    unoptimized: true,
  },
  async headers() {
    // Mirrored product images never change, so let browsers and the CDN keep them.
    return [{ source: "/product-images/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] }];
  },
};

export default nextConfig;
