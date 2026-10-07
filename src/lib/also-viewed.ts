import "server-only";

import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/db";
import { products, productViews } from "@/db/schema";
import type { ProductCardData } from "@/lib/catalog";

/** Below this many co-viewed products the section says "More from …" instead (owner decision: no fake data). */
export const MIN_CO_VIEWED = 3;

const cardFields = {
  id: products.id,
  slug: products.slug,
  title: products.title,
  thumbnail: products.thumbnail,
  priceCents: products.priceCents,
  listPriceCents: products.listPriceCents,
  rating: products.rating,
  ratingCount: products.ratingCount,
  stock: products.stock,
  dispatchDaysMin: products.dispatchDaysMin,
  dispatchDaysMax: products.dispatchDaysMax,
  sizeType: products.sizeType,
};

/** Products viewed by the same (anonymous) visitors who viewed this one, most shared first. */
export async function getAlsoViewed(productId: number): Promise<{ items: ProductCardData[]; fromViews: boolean }> {
  "use cache";
  cacheLife("minutes");
  cacheTag("product-views");
  const other = alias(productViews, "other");
  const ranked = await db
    .select({ id: other.productId, n: sql<number>`count(*)::int` })
    .from(productViews)
    .innerJoin(other, and(eq(other.visitorId, productViews.visitorId), ne(other.productId, productViews.productId)))
    .where(eq(productViews.productId, productId))
    .groupBy(other.productId)
    .orderBy(desc(sql`count(*)`))
    .limit(5);
  if (ranked.length < MIN_CO_VIEWED) return { items: [], fromViews: false };
  const rows = await db.select(cardFields).from(products).where(inArray(products.id, ranked.map((r) => r.id)));
  const order = new Map(ranked.map((r, i) => [r.id, i]));
  return { items: rows.sort((a, b) => order.get(a.id)! - order.get(b.id)!), fromViews: true };
}

export async function recordView(visitorId: string, productId: number) {
  await db
    .insert(productViews)
    .values({ visitorId, productId })
    .onConflictDoUpdate({ target: [productViews.visitorId, productViews.productId], set: { viewedAt: new Date() } });
}
