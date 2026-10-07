import "server-only";

import { asc, desc, gt, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/db";
import { categories, products } from "@/db/schema";

/** Fields every product card needs. */
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
};

export type ProductCardData = {
  id: number;
  slug: string;
  title: string;
  thumbnail: string;
  priceCents: number;
  listPriceCents: number;
  rating: number;
  ratingCount: number;
  stock: number;
  dispatchDaysMin: number;
  dispatchDaysMax: number;
};

export async function getDeals(limit = 5): Promise<ProductCardData[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog");
  return db
    .select(cardFields)
    .from(products)
    .where(gt(products.stock, 0))
    .orderBy(desc(sql`(${products.listPriceCents} - ${products.priceCents})::float / ${products.listPriceCents}`), asc(products.id))
    .limit(limit);
}

export async function getTopRated(limit = 5): Promise<ProductCardData[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog");
  return db
    .select(cardFields)
    .from(products)
    .where(gt(products.stock, 0))
    .orderBy(desc(products.rating), desc(products.ratingCount))
    .limit(limit);
}

export async function getCategories() {
  "use cache";
  cacheLife("days");
  cacheTag("catalog");
  return db.select().from(categories).orderBy(asc(categories.sortOrder));
}
