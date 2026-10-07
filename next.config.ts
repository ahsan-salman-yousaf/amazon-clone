import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    // DummyJSON already serves small WebP files; serving them as-is keeps us
    // clear of Vercel Hobby's image-optimization quota (owner decision).
    unoptimized: true,
    remotePatterns: [new URL("https://cdn.dummyjson.com/product-images/**")],
  },
};

export default nextConfig;
