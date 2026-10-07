import "server-only";

import { and, asc, count, desc, eq, gt, gte, inArray, lt, lte, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { categories, products } from "@/db/schema";
import type { ProductCardData } from "@/lib/catalog";

export const PAGE_SIZE = 24;

export const SORTS = {
  featured: "Featured",
  price_asc: "Price: low to high",
  price_desc: "Price: high to low",
  rating: "Top rated",
  discount: "Biggest discount",
} as const;
export type SortKey = keyof typeof SORTS;

/** Preset price bands, in cents. "lo-hi" with an open upper end allowed ("50000-"). */
export const PRICE_BANDS = [
  ["0-2500", "Under $25"],
  ["2500-10000", "$25 to $100"],
  ["10000-50000", "$100 to $500"],
  ["50000-", "$500 & up"],
] as const;

/** "Fast" delivery = leaves the warehouse within a business day. */
export const FAST_DISPATCH_DAYS = 1;

export type SearchFilters = {
  q: string;
  category?: string;
  brands: string[];
  price?: string;
  minRating?: number;
  fast: boolean;
  inStock: boolean;
  sort: SortKey;
  page: number;
};

type RawParams = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export function parseFilters(params: RawParams, category?: string): SearchFilters {
  const sort = one(params.sort) as SortKey;
  const rating = Number(one(params.rating));
  const price = one(params.price);
  return {
    q: one(params.q).trim().slice(0, 100),
    category: category ?? (one(params.cat) || undefined),
    brands: one(params.brand)
      .split(",")
      .map((b) => b.trim())
      .filter(Boolean)
      .slice(0, 20),
    price: PRICE_BANDS.some(([v]) => v === price) ? price : undefined,
    minRating: rating === 3 || rating === 4 ? rating : undefined,
    fast: one(params.fast) === "1",
    inStock: one(params.stock) === "1",
    sort: sort in SORTS ? sort : "featured",
    page: Math.max(1, Math.min(50, Number.parseInt(one(params.page), 10) || 1)),
  };
}

/** Lowercase alphanumeric words, max 8. */
const words = (q: string) =>
  q
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .slice(0, 8);

/**
 * Text match for one mode. Full-text with prefix matching ("head" → headphones),
 * OR a substring hit on title/brand/category ("phone" → iPhone, smartphones).
 */
function textMatch(ws: string[], mode: "all" | "any"): SQL {
  const join = mode === "all" ? " & " : " | ";
  const tsq = ws.map((w) => `${w}:*`).join(join);
  const hay = sql`lower(${products.title} || ' ' || coalesce(${products.brand}, '') || ' ' || ${products.categorySlug})`;
  const subs = ws.map((w) => sql`${hay} like ${"%" + w + "%"}`);
  const sub = sql.join(subs, sql.raw(mode === "all" ? " and " : " or "));
  return sql`(${products.search} @@ to_tsquery('english', ${tsq}) or (${sub}))`;
}

const rank = (ws: string[]) =>
  sql`ts_rank(${products.search}, to_tsquery('english', ${ws.map((w) => `${w}:*`).join(" | ")}))
      + case when lower(${products.title}) like ${"%" + ws.join(" ") + "%"} then 1 else 0 end`;

function filterConditions(f: SearchFilters, opts: { skipBrand?: boolean; skipCategory?: boolean } = {}): SQL[] {
  const c: SQL[] = [];
  if (f.category && !opts.skipCategory) c.push(eq(products.categorySlug, f.category));
  if (f.brands.length && !opts.skipBrand) c.push(inArray(products.brand, f.brands));
  if (f.price) {
    const [lo, hi] = f.price.split("-");
    c.push(gte(products.priceCents, Number(lo)));
    if (hi) c.push(lt(products.priceCents, Number(hi)));
  }
  if (f.minRating) c.push(gte(products.rating, f.minRating));
  if (f.fast) c.push(lte(products.dispatchDaysMin, FAST_DISPATCH_DAYS));
  if (f.inStock) c.push(gt(products.stock, 0));
  return c;
}

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

export type SearchResult = {
  items: ProductCardData[];
  total: number;
  /** True when no product had every word, so results match any word. */
  relaxed: boolean;
  brands: { name: string; count: number }[];
  departments: { slug: string; name: string; count: number }[];
};

export async function searchProducts(f: SearchFilters): Promise<SearchResult> {
  const ws = words(f.q);

  let mode: "all" | "any" | null = ws.length ? "all" : null;
  if (mode === "all") {
    const [{ n }] = await db
      .select({ n: count() })
      .from(products)
      .where(and(textMatch(ws, "all"), ...filterConditions(f)));
    if (n === 0 && ws.length > 1) mode = "any";
  }
  const text = mode ? [textMatch(ws, mode)] : [];
  const where = and(...text, ...filterConditions(f));

  const order: SQL[] = {
    featured: mode ? [desc(rank(ws)), desc(products.ratingCount)] : [desc(products.ratingCount)],
    price_asc: [asc(products.priceCents)],
    price_desc: [desc(products.priceCents)],
    rating: [desc(products.rating), desc(products.ratingCount)],
    discount: [desc(sql`(${products.listPriceCents} - ${products.priceCents})::float / ${products.listPriceCents}`)],
  }[f.sort];

  // Facet counts ignore their own filter, so several brands can be picked at once.
  const [items, [{ total }], brands, departments] = await Promise.all([
    db
      .select(cardFields)
      .from(products)
      .where(where)
      .orderBy(...order, asc(products.id))
      .limit(PAGE_SIZE)
      .offset((f.page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(products).where(where),
    db
      .select({ name: products.brand, count: count() })
      .from(products)
      .where(and(...text, ...filterConditions(f, { skipBrand: true }), sql`${products.brand} is not null`))
      .groupBy(products.brand)
      .orderBy(desc(count()), asc(products.brand))
      .limit(10),
    f.category
      ? Promise.resolve([])
      : db
          .select({ slug: categories.slug, name: categories.name, count: count() })
          .from(products)
          .innerJoin(categories, eq(categories.slug, products.categorySlug))
          .where(and(...text, ...filterConditions(f, { skipCategory: true })))
          .groupBy(categories.slug, categories.name)
          .orderBy(desc(count()))
          .limit(8),
  ]);

  return {
    items,
    total,
    relaxed: mode === "any",
    brands: brands.flatMap((b) => (b.name ? [{ name: b.name, count: b.count }] : [])),
    departments,
  };
}
