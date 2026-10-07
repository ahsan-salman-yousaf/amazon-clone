import "server-only";

import { and, eq, isNull, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { currentUserId } from "@/auth";
import { db } from "@/db";
import { cartItems, carts, products, productVariants } from "@/db/schema";

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
      await db
        .insert(cartItems)
        .values({ cartId: own.id, productId: l.productId, variantId: l.variantId, quantity: l.quantity, savedForLater: true })
        .onConflictDoNothing();
    } else {
      await addItem(own.id, l.productId, l.quantity, l.variantId);
    }
  }
  await db.delete(carts).where(eq(carts.id, guest.id));
}

export type AddItemResult = { ok: true; quantity: number } | { ok: false; reason: "size_required" | "invalid_size" | "out_of_stock" };

/**
 * Adds quantity to a line (product + size), capped at min(stock, MAX_PER_LINE)
 * in one statement. Sized products must name a size of that product.
 */
export async function addItem(cartId: string, productId: number, quantity: number, variantId?: number | null): Promise<number> {
  const r = await addItemChecked(cartId, productId, quantity, variantId);
  return r.ok ? r.quantity : 0;
}

export async function addItemChecked(cartId: string, productId: number, quantity: number, variantId?: number | null): Promise<AddItemResult> {
  const qty = Math.max(1, Math.min(MAX_PER_LINE, Math.floor(quantity)));
  const [p] = await db.select({ sizeType: products.sizeType }).from(products).where(eq(products.id, productId)).limit(1);
  if (!p) return { ok: false, reason: "out_of_stock" };
  const vId = p.sizeType ? (variantId ?? null) : null;
  if (p.sizeType && !vId) return { ok: false, reason: "size_required" };
  if (vId) {
    const [v] = await db.select({ id: productVariants.id }).from(productVariants).where(and(eq(productVariants.id, vId), eq(productVariants.productId, productId))).limit(1);
    if (!v) return { ok: false, reason: "invalid_size" };
  }
  const cap = vId
    ? sql`(select least(${productVariants.stock}, ${MAX_PER_LINE}) from ${productVariants} where ${productVariants.id} = ${vId})`
    : sql`(select least(${products.stock}, ${MAX_PER_LINE}) from ${products} where ${products.id} = ${productId})`;
  const [row] = await db
    .insert(cartItems)
    .values({ cartId, productId, variantId: vId, quantity: sql`least(${qty}, ${cap})`, savedForLater: false })
    .onConflictDoUpdate({
      target: [cartItems.cartId, cartItems.productId, cartItems.variantId],
      set: { quantity: sql`least(${cartItems.quantity} + ${qty}, ${cap})`, savedForLater: false },
    })
    .returning({ id: cartItems.id, quantity: cartItems.quantity });
  await db.update(carts).set({ updatedAt: new Date() }).where(eq(carts.id, cartId));
  if (!row || row.quantity <= 0) {
    if (row) await db.delete(cartItems).where(eq(cartItems.id, row.id));
    return { ok: false, reason: "out_of_stock" };
  }
  return { ok: true, quantity: row.quantity };
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
  /** cart_items.id: identifies product + size. */
  lineId: number;
  productId: number;
  variantId: number | null;
  /** e.g. "M" or "US 9.5"; null for unsized products. */
  sizeLabel: string | null;
  slug: string;
  title: string;
  thumbnail: string;
  priceCents: number;
  listPriceCents: number;
  /** Stock of the chosen size, or of the product when unsized. */
  stock: number;
  dispatchDaysMin: number;
  dispatchDaysMax: number;
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
      lineId: cartItems.id,
      productId: products.id,
      variantId: cartItems.variantId,
      sizeLabel: productVariants.label,
      slug: products.slug,
      title: products.title,
      thumbnail: products.thumbnail,
      priceCents: products.priceCents,
      listPriceCents: products.listPriceCents,
      // A sized product without a size (a line from before sizes existed) can't be bought.
      stock: sql<number>`case when ${products.sizeType} is not null and ${cartItems.variantId} is null then 0 else coalesce(${productVariants.stock}, ${products.stock}) end`,
      dispatchDaysMin: products.dispatchDaysMin,
      dispatchDaysMax: products.dispatchDaysMax,
      quantity: cartItems.quantity,
      savedForLater: cartItems.savedForLater,
    })
    .from(cartItems)
    .innerJoin(products, eq(products.id, cartItems.productId))
    .leftJoin(productVariants, eq(productVariants.id, cartItems.variantId))
    .where(eq(cartItems.cartId, cartId))
    .orderBy(sql`${cartItems.addedAt} desc`, cartItems.id);

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

// Line edits are addressed by cart_items.id and always scoped to the caller's cart.
const line = (cartId: string, lineId: number) => and(eq(cartItems.cartId, cartId), eq(cartItems.id, lineId));

export async function setQuantity(cartId: string, lineId: number, quantity: number) {
  const qty = Math.floor(quantity);
  if (qty <= 0) return removeItem(cartId, lineId);
  const cap = sql`(select least(coalesce(${productVariants.stock}, ${products.stock}), ${MAX_PER_LINE})
                     from ${cartItems} ci join ${products} on ${products.id} = ci.product_id
                     left join ${productVariants} on ${productVariants.id} = ci.variant_id
                    where ci.id = ${lineId})`;
  await db.update(cartItems).set({ quantity: sql`greatest(1, least(${qty}, ${cap}))` }).where(line(cartId, lineId));
}

export async function removeItem(cartId: string, lineId: number) {
  const [gone] = await db.delete(cartItems).where(line(cartId, lineId)).returning({ productId: cartItems.productId, variantId: cartItems.variantId });
  return gone ?? null;
}

export async function setSavedForLater(cartId: string, lineId: number, saved: boolean) {
  await db.update(cartItems).set({ savedForLater: saved }).where(line(cartId, lineId));
}
