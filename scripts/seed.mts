// Seeds the catalog from the open DummyJSON demo dataset (owner decision).
// Safe to re-run: categories and products are upserted by key, and only
// seeded reviews (no user_id) are replaced. Orders and carts are never touched.
//
//   pnpm db:seed

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { isNull, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { categories, products, reviews, users } from "../src/db/schema.ts";
import { DEMO_EMAIL, DEMO_NAME, DEMO_PASSWORD } from "../src/lib/demo.ts";

type DummyProduct = {
  id: number;
  title: string;
  description: string;
  category: string;
  price: number;
  discountPercentage: number;
  rating: number;
  stock: number;
  tags: string[];
  brand?: string;
  sku: string;
  weight: number;
  warrantyInformation: string;
  shippingInformation: string;
  returnPolicy: string;
  images: string[];
  thumbnail: string;
  reviews: { rating: number; comment: string; date: string; reviewerName: string }[];
};

const EXCLUDED = new Set(["vehicle", "motorcycle"]);
// We carry a "not affiliated with Amazon" notice, so no Amazon-branded products (owner decision).
const isExcludedBrand = (p: DummyProduct) => /amazon/i.test(`${p.brand ?? ""} ${p.title}`);

// Display names and shelf order (most-shopped first).
const CATEGORY_META: Record<string, [name: string, order: number]> = {
  smartphones: ["Smartphones", 1],
  laptops: ["Laptops", 2],
  tablets: ["Tablets", 3],
  "mobile-accessories": ["Mobile Accessories", 4],
  "kitchen-accessories": ["Kitchen", 5],
  "home-decoration": ["Home Decor", 6],
  furniture: ["Furniture", 7],
  groceries: ["Groceries", 8],
  beauty: ["Beauty", 9],
  "skin-care": ["Skin Care", 10],
  fragrances: ["Fragrances", 11],
  "sports-accessories": ["Sports & Outdoors", 12],
  "mens-shirts": ["Men's Shirts", 13],
  "mens-shoes": ["Men's Shoes", 14],
  "mens-watches": ["Men's Watches", 15],
  tops: ["Women's Tops", 16],
  "womens-dresses": ["Women's Dresses", 17],
  "womens-shoes": ["Women's Shoes", 18],
  "womens-bags": ["Women's Bags", 19],
  "womens-jewellery": ["Women's Jewelry", 20],
  "womens-watches": ["Women's Watches", 21],
  sunglasses: ["Sunglasses", 22],
};

// "Ships in …" text -> business days before dispatch.
const DISPATCH: Record<string, [min: number, max: number]> = {
  "Ships overnight": [0, 1],
  "Ships in 1-2 business days": [1, 2],
  "Ships in 3-5 business days": [3, 5],
  "Ships in 1 week": [5, 7],
  "Ships in 2 weeks": [10, 14],
  "Ships in 1 month": [20, 25],
};

const cents = (dollars: number) => Math.round(dollars * 100);

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-");

// Stable pseudo-random rating count per product id, so re-seeding never changes it.
function ratingCount(id: number) {
  let x = (id * 2654435761) >>> 0;
  x ^= x >>> 16;
  const r = (x % 1000) / 1000;
  return Math.round(12 + r * r * 8000);
}

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (see .env.example).");
  const db = drizzle(neon(url));

  const res = await fetch("https://dummyjson.com/products?limit=0");
  if (!res.ok) throw new Error(`DummyJSON responded ${res.status}`);
  const all = ((await res.json()) as { products: DummyProduct[] }).products;
  const items = all.filter((p) => !EXCLUDED.has(p.category) && !isExcludedBrand(p));

  const unknown = [...new Set(items.map((p) => p.category))].filter((c) => !CATEGORY_META[c]);
  if (unknown.length) throw new Error(`No display name for categories: ${unknown.join(", ")}`);

  await db
    .insert(categories)
    .values(Object.entries(CATEGORY_META).map(([slug, [name, sortOrder]]) => ({ slug, name, sortOrder })))
    .onConflictDoUpdate({
      target: categories.slug,
      set: { name: sql`excluded.name`, sortOrder: sql`excluded.sort_order` },
    });

  const seen = new Set<string>();
  const rows = items.map((p) => {
    let slug = slugify(p.title);
    if (seen.has(slug)) slug = `${slug}-${p.id}`;
    seen.add(slug);

    const listPriceCents = cents(p.price);
    // Discounts under 1% read as noise on a price tag; treat them as none.
    const priceCents =
      p.discountPercentage >= 1 ? Math.round(listPriceCents * (1 - p.discountPercentage / 100)) : listPriceCents;
    const [dispatchDaysMin, dispatchDaysMax] = DISPATCH[p.shippingInformation] ?? [3, 5];

    return {
      id: p.id,
      slug,
      title: p.title,
      description: p.description,
      brand: p.brand ?? null,
      categorySlug: p.category,
      tags: p.tags,
      sku: p.sku,
      priceCents,
      listPriceCents,
      rating: Math.round(p.rating * 10) / 10,
      ratingCount: ratingCount(p.id),
      stock: p.stock,
      thumbnail: p.thumbnail,
      images: p.images,
      dispatchDaysMin,
      dispatchDaysMax,
      warranty: p.warrantyInformation,
      returnPolicy: p.returnPolicy,
      weightGrams: Math.round(p.weight * 100),
    };
  });

  const excluded = (col: string) => sql.raw(`excluded.${col}`);
  await db
    .insert(products)
    .values(rows)
    .onConflictDoUpdate({
      target: products.id,
      set: {
        slug: excluded("slug"),
        title: excluded("title"),
        description: excluded("description"),
        brand: excluded("brand"),
        categorySlug: excluded("category_slug"),
        tags: excluded("tags"),
        sku: excluded("sku"),
        priceCents: excluded("price_cents"),
        listPriceCents: excluded("list_price_cents"),
        rating: excluded("rating"),
        ratingCount: excluded("rating_count"),
        stock: excluded("stock"),
        thumbnail: excluded("thumbnail"),
        images: excluded("images"),
        dispatchDaysMin: excluded("dispatch_days_min"),
        dispatchDaysMax: excluded("dispatch_days_max"),
        warranty: excluded("warranty"),
        returnPolicy: excluded("return_policy"),
        weightGrams: excluded("weight_grams"),
      },
    });

  // Remove anything a previous seed loaded that is now excluded.
  await db.execute(sql`delete from products where brand ilike '%amazon%' or title ilike '%amazon%'`);

  // Keep the serial in step with the explicit DummyJSON ids.
  await db.execute(sql`select setval(pg_get_serial_sequence('products', 'id'), (select max(id) from products))`);

  // Seeded reviews: reviewer names only. DummyJSON's reviewer emails are not stored.
  await db.delete(reviews).where(isNull(reviews.userId));
  await db.insert(reviews).values(
    items.flatMap((p) =>
      p.reviews.map((r) => ({
        productId: p.id,
        authorName: r.reviewerName,
        rating: r.rating,
        comment: r.comment,
        createdAt: new Date(r.date),
      })),
    ),
  );

  // Demo shopper for the one-click sign-in (password is public by design).
  await db
    .insert(users)
    .values({ name: DEMO_NAME, email: DEMO_EMAIL, passwordHash: await bcrypt.hash(DEMO_PASSWORD, 10) })
    .onConflictDoNothing();

  const [{ count }] = (await db.execute(sql`select count(*)::int as count from products`)).rows as { count: number }[];
  console.log(`Seeded ${Object.keys(CATEGORY_META).length} categories, ${rows.length} products (${count} in table), reviews.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
