import "server-only";

import { and, asc, desc, eq, gt, ne, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/db";
import { categories, products, reviews } from "@/db/schema";

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

export async function getAllProductSlugs() {
  "use cache";
  cacheLife("days");
  cacheTag("catalog");
  return db.select({ slug: products.slug }).from(products);
}

export async function getProduct(slug: string) {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog", `product:${slug}`);
  const [row] = await db
    .select({ product: products, categoryName: categories.name })
    .from(products)
    .innerJoin(categories, eq(categories.slug, products.categorySlug))
    .where(eq(products.slug, slug))
    .limit(1);
  if (!row) return null;
  // The tsvector column is internal to search; keep it out of the page payload.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { search: _search, ...product } = row.product;
  const [productReviews, related] = await Promise.all([
    db
      .select({ id: reviews.id, authorName: reviews.authorName, rating: reviews.rating, comment: reviews.comment, createdAt: reviews.createdAt })
      .from(reviews)
      .where(eq(reviews.productId, product.id))
      .orderBy(desc(reviews.createdAt)),
    db
      .select(cardFields)
      .from(products)
      .where(and(eq(products.categorySlug, product.categorySlug), ne(products.id, product.id)))
      .orderBy(desc(products.rating), desc(products.ratingCount))
      .limit(5),
  ]);
  return { product, categoryName: row.categoryName, reviews: productReviews, related };
}
