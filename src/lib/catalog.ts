import "server-only";

import { and, asc, desc, eq, gt, gte, ne, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/db";
import { categories, products, productVariants, reviews } from "@/db/schema";

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
  sizeType: products.sizeType,
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
  /** Set for sized products (shoes, clothing, watches); quick-add then asks for a size. */
  sizeType?: "shoe_men" | "shoe_women" | "apparel" | "watch_band" | null;
};

export const DEAL_MIN_RATING = 4;

export async function getDeals(limit = 5): Promise<ProductCardData[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog");
  return db
    .select(cardFields)
    .from(products)
    // Owner decision: the deals rail only shows products rated 4 stars and up.
    .where(and(gt(products.stock, 0), gte(products.rating, DEAL_MIN_RATING)))
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
  // Own tag: product edits (reviews, ratings) must never invalidate the header or category pages.
  cacheTag("categories");
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
      .select({ id: reviews.id, authorName: reviews.authorName, rating: reviews.rating, title: reviews.title, comment: reviews.comment, verified: reviews.verified, createdAt: reviews.createdAt })
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
  const variants = product.sizeType ? await listVariants(product.id) : [];
  return { product, categoryName: row.categoryName, reviews: productReviews, related, variants };
}

export type SizeOption = { id: number; label: string; stock: number };

/** A product's sizes in display order (empty for unsized products). */
export async function listVariants(productId: number): Promise<SizeOption[]> {
  return db
    .select({ id: productVariants.id, label: productVariants.label, stock: productVariants.stock })
    .from(productVariants)
    .where(eq(productVariants.productId, productId))
    .orderBy(asc(productVariants.sortOrder));
}
