/**
 * Product images are mirrored into public/product-images/ (owner decision:
 * DummyJSON's CDN is slow and drops connections). This maps a DummyJSON URL
 * to its local path; apostrophes are dropped so paths stay URL-safe.
 */
export const DUMMYJSON_IMAGE_PREFIX = "https://cdn.dummyjson.com/product-images/";

export function localImagePath(url: string) {
  if (!url.startsWith(DUMMYJSON_IMAGE_PREFIX)) return url;
  const rest = decodeURIComponent(url.slice(DUMMYJSON_IMAGE_PREFIX.length)).replace(/'/g, "");
  return `/product-images/${rest}`;
}
