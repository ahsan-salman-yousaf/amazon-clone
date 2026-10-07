// Seeds the catalog from the open DummyJSON demo dataset (owner decision).
// Safe to re-run: categories and products are upserted by key, and only
// seeded reviews (no user_id) are replaced. Orders and carts are never touched.
//
//   pnpm db:seed

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, inArray, isNull, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { addresses, categories, orderEvents, orderItems, orders, payments, products, productVariants, reviews, users } from "../src/db/schema.ts";
import { DEMO_EMAIL, DEMO_NAME, DEMO_PASSWORD } from "../src/lib/demo.ts";
import { DUMMYJSON_IMAGE_PREFIX, localImagePath } from "../src/lib/images.ts";
import { SIZE_TYPE_BY_CATEGORY, SIZES, splitStock } from "../src/lib/sizes.ts";

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

// "Ships in …" text -> business days before dispatch. The slow tiers are
// compressed (owner decision) so the slowest delivery is about two weeks.
const DISPATCH: Record<string, [min: number, max: number]> = {
  "Ships overnight": [0, 1],
  "Ships in 1-2 business days": [1, 2],
  "Ships in 3-5 business days": [3, 5],
  "Ships in 1 week": [3, 5],
  "Ships in 2 weeks": [5, 7],
  "Ships in 1 month": [7, 10],
};

const cents = (dollars: number) => Math.round(dollars * 100);

/** DummyJSON dates every review on the same day; spread them over the past ~6 months, repeatably. */
function reviewDate(productId: number, index: number) {
  const daysAgo = 4 + ((productId * 37 + index * 53) % 175);
  const d = new Date(Date.now() - daysAgo * 86_400_000);
  d.setUTCHours(9 + ((productId + index * 5) % 10), (productId * 7 + index * 13) % 60, 0, 0);
  return d;
}

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
      // Served from public/product-images (run scripts/mirror-images.mts first).
      thumbnail: localImagePath(p.thumbnail),
      images: p.images.map(localImagePath),
      dispatchDaysMin,
      dispatchDaysMax,
      warranty: p.warrantyInformation,
      returnPolicy: p.returnPolicy,
      weightGrams: Math.round(p.weight * 100),
      sizeType: SIZE_TYPE_BY_CATEGORY[p.category] ?? null,
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
        sizeType: excluded("size_type"),
      },
    });

  // Sizes (owner decision): split each sized product's stock across its sizes.
  let sized = 0;
  for (const r of rows) {
    if (!r.sizeType) continue;
    const labels = SIZES[r.sizeType];
    const counts = splitStock(r.id, r.stock, labels);
    await db
      .insert(productVariants)
      .values(labels.map((label, i) => ({ productId: r.id, label, sortOrder: i, stock: counts[i] })))
      .onConflictDoUpdate({
        target: [productVariants.productId, productVariants.label],
        set: { stock: sql`excluded.stock`, sortOrder: sql`excluded.sort_order` },
      });
    sized++;
  }
  await db.execute(sql`delete from product_variants v using products p where p.id = v.product_id and p.size_type is null`);
  // Keep products.stock equal to the sum of its sizes.
  await db.execute(sql`update products p set stock = s.total from (select product_id, sum(stock)::int total from product_variants group by product_id) s where s.product_id = p.id`);
  // Cart lines added before a product had sizes can't be bought; drop them.
  await db.execute(sql`delete from cart_items c using products p where p.id = c.product_id and p.size_type is not null and c.variant_id is null`);
  console.log(`Sized ${sized} products`);

  // Remove anything a previous seed loaded that is now excluded.
  await db.execute(sql`delete from products where brand ilike '%amazon%' or title ilike '%amazon%'`);

  // Keep the serial in step with the explicit DummyJSON ids.
  await db.execute(sql`select setval(pg_get_serial_sequence('products', 'id'), (select max(id) from products))`);

  // Seeded reviews: reviewer names only. DummyJSON's reviewer emails are not stored.
  await db.delete(reviews).where(isNull(reviews.userId));
  await db.insert(reviews).values(
    items.flatMap((p) =>
      p.reviews.map((r, i) => ({
        productId: p.id,
        authorName: r.reviewerName,
        rating: r.rating,
        comment: r.comment,
        createdAt: reviewDate(p.id, i),
      })),
    ),
  );

  // Demo shopper for the one-click sign-in (password is public by design).
  await db
    .insert(users)
    .values({ name: DEMO_NAME, email: DEMO_EMAIL, passwordHash: await bcrypt.hash(DEMO_PASSWORD, 10) })
    .onConflictDoNothing();
  const [demo] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${DEMO_EMAIL}`);
  const hasAddress = (await db.select({ id: addresses.id }).from(addresses).where(eq(addresses.userId, demo.id)).limit(1)).length;
  if (!hasAddress) {
    // Fictional sample address so judges can check out without typing one.
    await db.insert(addresses).values({
      userId: demo.id,
      fullName: DEMO_NAME,
      line1: "350 Olympus Way",
      line2: "Suite 12",
      city: "Seattle",
      state: "WA",
      postalCode: "98101",
      country: "US",
      phone: "206-555-0142",
      isDefault: true,
    });
  }

  await seedDemoOrders(db, demo.id);
  // Order snapshots keep their own thumbnail copy; point old ones at the local files too.
  const stale = await db.select({ orderId: orderItems.orderId, productId: orderItems.productId, thumbnail: orderItems.thumbnail }).from(orderItems);
  for (const it of stale.filter((i) => i.thumbnail.startsWith(DUMMYJSON_IMAGE_PREFIX))) {
    await db
      .update(orderItems)
      .set({ thumbnail: localImagePath(it.thumbnail) })
      .where(sql`${orderItems.orderId} = ${it.orderId} and ${orderItems.productId} = ${it.productId}`);
  }

  const [{ count }] = (await db.execute(sql`select count(*)::int as count from products`)).rows as { count: number }[];
  console.log(`Seeded ${Object.keys(CATEGORY_META).length} categories, ${rows.length} products (${count} in table), reviews.`);
}

/**
 * Backdated, already-delivered sample orders on the demo account, clearly
 * numbered OC-DEMO-*, so judges can try order history and returns at once.
 * Paid with the simulated provider (no Stripe charge exists for them).
 */
async function seedDemoOrders(db: ReturnType<typeof drizzle>, userId: string) {
  const day = 86_400_000;
  const now = Date.now();
  const samples = [
    { number: "OC-DEMO-0001", placedDaysAgo: 9, deliveredDaysAgo: 4, slugs: [["white-faux-leather-backpack", 1], ["iphone-12-silicone-case-with-magsafe-plum", 2]] },
    { number: "OC-DEMO-0002", placedDaysAgo: 48, deliveredDaysAgo: 43, slugs: [["baseball-ball", 3]] },
  ] as const;
  const existing = await db.select({ number: orders.number }).from(orders).where(inArray(orders.number, samples.map((s) => s.number)));
  const have = new Set(existing.map((e) => e.number));
  const address = { fullName: DEMO_NAME, line1: "350 Olympus Way", line2: "Suite 12", city: "Seattle", state: "WA", postalCode: "98101", country: "US", phone: "206-555-0142" };

  for (const s of samples) {
    if (have.has(s.number)) continue;
    const rows = await db.select().from(products).where(inArray(products.slug, s.slugs.map(([slug]) => slug)));
    const lines = s.slugs.map(([slug, qty]) => ({ p: rows.find((r) => r.slug === slug)!, qty }));
    const subtotal = lines.reduce((t, l) => t + l.p.priceCents * l.qty, 0);
    const shipping = subtotal >= 3500 ? 0 : 599;
    const tax = Math.round(subtotal * 0.08);
    const placed = new Date(now - s.placedDaysAgo * day);
    const delivered = new Date(now - s.deliveredDaysAgo * day);
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const [o] = await db
      .insert(orders)
      .values({
        number: s.number,
        userId,
        status: "delivered",
        shippingSpeed: "standard",
        shippingAddress: address,
        subtotalCents: subtotal,
        shippingCents: shipping,
        taxCents: tax,
        totalCents: subtotal + shipping + tax,
        estimatedDeliveryFrom: iso(delivered),
        estimatedDeliveryTo: iso(delivered),
        createdAt: placed,
        updatedAt: delivered,
      })
      .returning({ id: orders.id });
    await db.insert(orderItems).values(lines.map((l) => ({ orderId: o.id, productId: l.p.id, title: l.p.title, thumbnail: l.p.thumbnail, unitPriceCents: l.p.priceCents, quantity: l.qty })));
    await db.insert(payments).values({
      orderId: o.id,
      provider: "simulated",
      providerRef: `sim_${s.number}`,
      idempotencyKey: `seed-${s.number}`,
      status: "succeeded",
      amountCents: subtotal + shipping + tax,
      cardBrand: "Visa",
      cardLast4: "4242",
      createdAt: placed,
    });
    await db.insert(orderEvents).values([
      { orderId: o.id, status: "pending_payment", note: "Order placed", at: placed },
      { orderId: o.id, status: "paid", note: "Paid with Visa ending 4242", at: new Date(placed.getTime() + 5_000) },
      { orderId: o.id, status: "shipped", note: "Shipped from the Olympus Cart warehouse", at: new Date(placed.getTime() + day) },
      { orderId: o.id, status: "delivered", note: "Delivered", at: delivered },
    ]);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
