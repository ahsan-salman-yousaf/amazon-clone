import "server-only";

import { and, eq, isNull, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { currentUserId } from "@/auth";
import { db } from "@/db";
import { cartItems, carts, products } from "@/db/schema";

// Guest carts: a DB row whose id lives in an httpOnly cookie (owner decision).
// Signed-in carts hang off users.id; merging happens at sign-in.
export const CART_COOKIE = "oc_cart";
const CART_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
/** Per-line cap, on top of the product's stock. */
export const MAX_PER_LINE = 10;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: CART_MAX_AGE,
};

/**
 * The current cart: the signed-in user's cart, or the guest cart in the cookie.
 * A cookie pointing at someone else's cart is ignored.
 */
export async function readCartId(): Promise<string | null> {
  const userId = await currentUserId();
  if (userId) {
    const [own] = await db.select({ id: carts.id }).from(carts).where(eq(carts.userId, userId)).limit(1);
    return own?.id ?? null;
  }
  const id = (await cookies()).get(CART_COOKIE)?.value;
  if (!id || !UUID.test(id)) return null;
  const [row] = await db.select({ id: carts.id }).from(carts).where(and(eq(carts.id, id), isNull(carts.userId))).limit(1);
  return row?.id ?? null;
}

/** Only call from a Server Action or Route Handler (it may set a cookie). */
export async function getOrCreateCartId(): Promise<string> {
  const existing = await readCartId();
  if (existing) return existing;
  const userId = await currentUserId();
  const [row] = await db
    .insert(carts)
    .values({ userId })
    .onConflictDoUpdate({ target: carts.userId, set: { updatedAt: new Date() } })
    .returning({ id: carts.id });
  if (!userId) (await cookies()).set(CART_COOKIE, row.id, cookieOptions);
  return row.id;
}

/**
 * On sign-in: move the guest cart's lines into the user's cart (quantities
 * add up, capped as usual), then drop the guest cart and its cookie.
 */
export async function mergeGuestCartInto(userId: string) {
  const jar = await cookies();
  const guestId = jar.get(CART_COOKIE)?.value;
  jar.delete(CART_COOKIE);
  if (!guestId || !UUID.test(guestId)) return;
  const [guest] = await db.select({ id: carts.id }).from(carts).where(and(eq(carts.id, guestId), isNull(carts.userId))).limit(1);
  if (!guest) return;

  const [own] = await db.select({ id: carts.id }).from(carts).where(eq(carts.userId, userId)).limit(1);
  if (!own) {
    await db.update(carts).set({ userId }).where(eq(carts.id, guest.id));
    return;
  }
  const lines = await db.select().from(cartItems).where(eq(cartItems.cartId, guest.id));
  for (const l of lines) {
    if (l.savedForLater) {
      await db.insert(cartItems).values({ ...l, cartId: own.id }).onConflictDoNothing();
    } else {
      await addItem(own.id, l.productId, l.quantity);
    }
  }
  await db.delete(carts).where(eq(carts.id, guest.id));
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
