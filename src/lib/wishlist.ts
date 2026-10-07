import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { products, wishlistItems } from "@/db/schema";

export async function wishlistIds(userId: string) {
  const rows = await db.select({ id: wishlistItems.productId }).from(wishlistItems).where(eq(wishlistItems.userId, userId));
  return rows.map((r) => r.id);
}

/** Adds or removes; returns whether the product is now saved. */
export async function setWishlisted(userId: string, productId: number, saved: boolean) {
  if (saved) {
    await db.insert(wishlistItems).values({ userId, productId }).onConflictDoNothing();
  } else {
    await db.delete(wishlistItems).where(and(eq(wishlistItems.userId, userId), eq(wishlistItems.productId, productId)));
  }
  return saved;
}

export async function listWishlist(userId: string) {
  return db
    .select({
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
      addedAt: wishlistItems.addedAt,
    })
    .from(wishlistItems)
    .innerJoin(products, eq(products.id, wishlistItems.productId))
    .where(eq(wishlistItems.userId, userId))
    .orderBy(desc(wishlistItems.addedAt));
}
