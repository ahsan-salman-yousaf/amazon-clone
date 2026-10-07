// Copies every DummyJSON product image into public/product-images/ so the site
// serves them from its own CDN (owner decision: DummyJSON's CDN is slow,
// uncached and drops connections under load). Safe to re-run: existing files
// are skipped.
//
//   node --experimental-strip-types scripts/mirror-images.mts

import { mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { DUMMYJSON_IMAGE_PREFIX as CDN_PREFIX, localImagePath } from "../src/lib/images.ts";

const PUBLIC = join(process.cwd(), "public");
const CONCURRENCY = 4;

type P = { category: string; title: string; brand?: string; thumbnail: string; images: string[] };

async function exists(path: string) {
  try {
    return (await stat(path)).size > 0;
  } catch {
    return false;
  }
}

async function download(url: string, attempt = 1): Promise<Buffer> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  } catch (e) {
    if (attempt >= 5) throw new Error(`${url}: ${(e as Error).message}`);
    await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
    return download(url, attempt + 1);
  }
}

async function main() {
  const res = await fetch("https://dummyjson.com/products?limit=0");
  const products = ((await res.json()) as { products: P[] }).products.filter((p) => !["vehicle", "motorcycle"].includes(p.category) && !/amazon/i.test(`${p.brand ?? ""} ${p.title}`));
  const urls = [...new Set(products.flatMap((p) => [p.thumbnail, ...p.images]))].filter((u) => u.startsWith(CDN_PREFIX));

  let done = 0;
  let skipped = 0;
  let bytes = 0;
  const failed: string[] = [];
  const queue = [...urls];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let url = queue.shift(); url; url = queue.shift()) {
        const path = join(PUBLIC, localImagePath(url));
        if (await exists(path)) {
          skipped++;
          continue;
        }
        try {
          const buf = await download(url);
          await mkdir(dirname(path), { recursive: true });
          await writeFile(path, buf);
          bytes += buf.length;
          done++;
          if (done % 50 === 0) console.log(`…${done} downloaded`);
        } catch (e) {
          failed.push((e as Error).message);
        }
      }
    }),
  );
  console.log(`Images: ${urls.length} total, ${done} downloaded (${(bytes / 1e6).toFixed(1)} MB), ${skipped} already present, ${failed.length} failed`);
  if (failed.length) {
    console.error(failed.join("\n"));
    process.exit(1);
  }
}

main();
