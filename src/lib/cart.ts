import "server-only";

import { and, eq, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db";
import { cartItems, carts, products } from "@/db/schema";

// Guest carts: a DB row whose id lives in an httpOnly cookie (owner decision).
// Signed-in carts hang off users.id; merging happens at sign-in.
export const CART_COOKIE = "oc_cart";
const CART_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
/** Per-line cap, on top of the product's stock. */
export const MAX_PER_LINE = 10;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The current cart id from the cookie, if it points at a real cart. */
export async function readCartId(): Promise<string | null> {
  const id = (await cookies()).get(CART_COOKIE)?.value;
  if (!id || !UUID.test(id)) return null;
  const [row] = await db.select({ id: carts.id }).from(carts).where(eq(carts.id, id)).limit(1);
  return row?.id ?? null;
}

/** Only call from a Server Action or Route Handler (it may set a cookie). */
export async function getOrCreateCartId(): Promise<string> {
  const existing = await readCartId();
  if (existing) return existing;
  const [row] = await db.insert(carts).values({}).returning({ id: carts.id });
  (await cookies()).set(CART_COOKIE, row.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: CART_MAX_AGE,
  });
  return row.id;
}

/**
 * Adds quantity to a line, capped at min(stock, MAX_PER_LINE) in one statement.
 * Returns the resulting line quantity, or 0 if the product can't be bought.
 */
export async function addItem(cartId: string, productId: number, quantity: number): Promise<number> {
  const qty = Math.max(1, Math.min(MAX_PER_LINE, Math.floor(quantity)));
  const cap = sql`(select least(${products.stock}, ${MAX_PER_LINE}) from ${products} where ${products.id} = ${productId})`;
  const [row] = await db
    .insert(cartItems)
    .values({ cartId, productId, quantity: sql`least(${qty}, ${cap})`, savedForLater: false })
    .onConflictDoUpdate({
      target: [cartItems.cartId, cartItems.productId],
      set: { quantity: sql`least(${cartItems.quantity} + ${qty}, ${cap})`, savedForLater: false },
    })
    .returning({ quantity: cartItems.quantity });
  await db.update(carts).set({ updatedAt: new Date() }).where(eq(carts.id, cartId));
  if (!row || row.quantity <= 0) {
    await db.delete(cartItems).where(and(eq(cartItems.cartId, cartId), eq(cartItems.productId, productId)));
    return 0;
  }
  return row.quantity;
}

/** Number of items (not lines) waiting to be bought; saved-for-later excluded. */
export async function cartCount(cartId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`coalesce(sum(${cartItems.quantity}), 0)::int` })
    .from(cartItems)
    .where(and(eq(cartItems.cartId, cartId), eq(cartItems.savedForLater, false)));
  return row?.n ?? 0;
}

export type CartLine = {
  productId: number;
  slug: string;
  title: string;
  thumbnail: string;
  priceCents: number;
  listPriceCents: number;
  stock: number;
  quantity: number;
  savedForLater: boolean;
};

export type CartView = {
  id: string | null;
  lines: CartLine[];
  saved: CartLine[];
  /** Items that can be bought now (in stock), with quantities clamped to stock. */
  itemCount: number;
  subtotalCents: number;
};

const EMPTY: CartView = { id: null, lines: [], saved: [], itemCount: 0, subtotalCents: 0 };

/** Live prices and stock come from products, never from what the cart stored. */
export async function getCartView(cartId: string | null): Promise<CartView> {
  if (!cartId) return EMPTY;
  const rows = await db
    .select({
      productId: products.id,
      slug: products.slug,
      title: products.title,
      thumbnail: products.thumbnail,
      priceCents: products.priceCents,
      listPriceCents: products.listPriceCents,
      stock: products.stock,
      quantity: cartItems.quantity,
      savedForLater: cartItems.savedForLater,
    })
    .from(cartItems)
    .innerJoin(products, eq(products.id, cartItems.productId))
    .where(eq(cartItems.cartId, cartId))
    .orderBy(sql`${cartItems.addedAt} desc`);

  const lines = rows.filter((r) => !r.savedForLater);
  const buyable = lines.filter((l) => l.stock > 0);
  return {
    id: cartId,
    lines,
    saved: rows.filter((r) => r.savedForLater),
    itemCount: buyable.reduce((n, l) => n + Math.min(l.quantity, l.stock), 0),
    subtotalCents: buyable.reduce((s, l) => s + l.priceCents * Math.min(l.quantity, l.stock), 0),
  };
}

const line = (cartId: string, productId: number) => and(eq(cartItems.cartId, cartId), eq(cartItems.productId, productId));

export async function setQuantity(cartId: string, productId: number, quantity: number) {
  const qty = Math.floor(quantity);
  if (qty <= 0) return removeItem(cartId, productId);
  const cap = sql`(select least(${products.stock}, ${MAX_PER_LINE}) from ${products} where ${products.id} = ${productId})`;
  await db.update(cartItems).set({ quantity: sql`greatest(1, least(${qty}, ${cap}))` }).where(line(cartId, productId));
}

export async function removeItem(cartId: string, productId: number) {
  await db.delete(cartItems).where(line(cartId, productId));
}

export async function setSavedForLater(cartId: string, productId: number, saved: boolean) {
  await db.update(cartItems).set({ savedForLater: saved }).where(line(cartId, productId));
}
