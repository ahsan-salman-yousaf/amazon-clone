import "server-only";

import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { addresses, cartItems, orderEvents, orderItems, orders, payments, products, type ShippingAddress } from "@/db/schema";
import { withTransaction } from "@/db/tx";
import type { AddressInput } from "@/lib/address";
import { EXPRESS_TRANSIT_DAYS, STANDARD_TRANSIT_DAYS, addBusinessDays } from "@/lib/delivery";
import { orderTotals, type ShippingSpeed } from "@/lib/pricing";
import type { CardInput, PaymentProvider } from "@/lib/payments/types";

const ORDER_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
function orderNumber() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const s = Array.from(bytes, (b) => ORDER_ALPHABET[b % ORDER_ALPHABET.length]).join("");
  return `OC-${s.slice(0, 4)}-${s.slice(4)}`;
}

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

export async function getDefaultAddress(userId: string) {
  const [a] = await db
    .select()
    .from(addresses)
    .where(eq(addresses.userId, userId))
    .orderBy(desc(addresses.isDefault), desc(addresses.createdAt))
    .limit(1);
  return a ?? null;
}

/** Saves the address as the user's default, reusing an identical saved one. */
async function saveDefaultAddress(userId: string, a: AddressInput) {
  const [existing] = await db
    .select({ id: addresses.id })
    .from(addresses)
    .where(
      and(
        eq(addresses.userId, userId),
        eq(addresses.line1, a.line1),
        eq(addresses.postalCode, a.postalCode),
        eq(addresses.fullName, a.fullName),
      ),
    )
    .limit(1);
  await db.update(addresses).set({ isDefault: false }).where(eq(addresses.userId, userId));
  if (existing) {
    await db.update(addresses).set({ ...a, isDefault: true }).where(eq(addresses.id, existing.id));
  } else {
    await db.insert(addresses).values({ ...a, userId, country: "US", isDefault: true });
  }
}

export type PlaceOrderResult = { ok: true; orderId: string } | { ok: false; message: string; orderId?: string };

/**
 * The server is the only source of truth for prices and stock: the cart is
 * re-read and re-priced here, never trusted from the browser.
 */
export async function placeOrder(input: {
  userId: string;
  cartId: string;
  address: AddressInput;
  speed: ShippingSpeed;
  idempotencyKey: string;
  card: CardInput;
  provider: PaymentProvider;
}): Promise<PlaceOrderResult> {
  // A double-click or retry with the same key returns the first order.
  const [prior] = await db
    .select({ orderId: payments.orderId, status: payments.status })
    .from(payments)
    .where(eq(payments.idempotencyKey, input.idempotencyKey))
    .limit(1);
  if (prior) {
    return prior.status === "succeeded"
      ? { ok: true, orderId: prior.orderId }
      : { ok: false, message: "That payment didn't go through. Please review your card and try again.", orderId: prior.orderId };
  }

  const lines = await db
    .select({
      productId: products.id,
      title: products.title,
      thumbnail: products.thumbnail,
      priceCents: products.priceCents,
      stock: products.stock,
      dispatchDaysMin: products.dispatchDaysMin,
      dispatchDaysMax: products.dispatchDaysMax,
      quantity: cartItems.quantity,
    })
    .from(cartItems)
    .innerJoin(products, eq(products.id, cartItems.productId))
    .where(and(eq(cartItems.cartId, input.cartId), eq(cartItems.savedForLater, false)));

  const buyable = lines.filter((l) => l.stock > 0).map((l) => ({ ...l, quantity: Math.min(l.quantity, l.stock) }));
  if (!buyable.length) return { ok: false, message: "Your cart is empty or its items are out of stock." };

  const subtotal = buyable.reduce((s, l) => s + l.priceCents * l.quantity, 0);
  const totals = orderTotals(subtotal, input.speed);
  const transit = input.speed === "expedited" ? EXPRESS_TRANSIT_DAYS : STANDARD_TRANSIT_DAYS;
  const now = new Date();
  const from = addBusinessDays(now, Math.max(...buyable.map((l) => l.dispatchDaysMin)) + transit);
  const to = addBusinessDays(now, Math.max(...buyable.map((l) => l.dispatchDaysMax)) + transit);

  const shippingAddress: ShippingAddress = { ...input.address, country: "US" };

  // 1. Reserve stock and create the order atomically.
  let orderId: string;
  let paymentId: string;
  try {
    ({ orderId, paymentId } = await withTransaction(async (tx) => {
      for (const l of buyable) {
        const taken = await tx
          .update(products)
          .set({ stock: sql`${products.stock} - ${l.quantity}` })
          .where(and(eq(products.id, l.productId), gte(products.stock, l.quantity)))
          .returning({ id: products.id });
        if (!taken.length) throw new OutOfStock(l.title);
      }
      const [order] = await tx
        .insert(orders)
        .values({
          number: orderNumber(),
          userId: input.userId,
          status: "pending_payment",
          shippingSpeed: input.speed,
          shippingAddress,
          ...totals,
          estimatedDeliveryFrom: isoDate(from),
          estimatedDeliveryTo: isoDate(to),
        })
        .returning({ id: orders.id });
      await tx.insert(orderItems).values(
        buyable.map((l) => ({
          orderId: order.id,
          productId: l.productId,
          title: l.title,
          thumbnail: l.thumbnail,
          unitPriceCents: l.priceCents,
          quantity: l.quantity,
        })),
      );
      await tx.insert(orderEvents).values({ orderId: order.id, status: "pending_payment", note: "Order placed" });
      const [payment] = await tx
        .insert(payments)
        .values({
          orderId: order.id,
          provider: input.provider.name,
          idempotencyKey: input.idempotencyKey,
          amountCents: totals.totalCents,
          status: "processing",
        })
        .returning({ id: payments.id });
      return { orderId: order.id, paymentId: payment.id };
    }));
  } catch (e) {
    if (e instanceof OutOfStock) return { ok: false, message: `Sorry, ${e.title} just sold out. Please review your cart.` };
    throw e;
  }

  // 2. Charge. 3. Record the outcome; on failure, give the stock back.
  const result = await input.provider.charge({ amountCents: totals.totalCents, idempotencyKey: input.idempotencyKey, card: input.card });

  if (result.status === "succeeded") {
    await withTransaction(async (tx) => {
      await tx
        .update(payments)
        .set({ status: "succeeded", providerRef: result.providerRef, cardBrand: result.brand, cardLast4: result.last4 })
        .where(eq(payments.id, paymentId));
      await tx.update(orders).set({ status: "paid" }).where(eq(orders.id, orderId));
      await tx.insert(orderEvents).values({ orderId, status: "paid", note: `Paid with ${result.brand} ending ${result.last4}` });
      await tx
        .delete(cartItems)
        .where(and(eq(cartItems.cartId, input.cartId), eq(cartItems.savedForLater, false), inArray(cartItems.productId, buyable.map((l) => l.productId))));
    });
    await saveDefaultAddress(input.userId, input.address);
    return { ok: true, orderId };
  }

  await withTransaction(async (tx) => {
    await tx.update(payments).set({ status: "failed", failureMessage: result.message, cardLast4: result.last4 }).where(eq(payments.id, paymentId));
    await tx.update(orders).set({ status: "payment_failed" }).where(eq(orders.id, orderId));
    await tx.insert(orderEvents).values({ orderId, status: "payment_failed", note: result.message });
    for (const l of buyable) {
      await tx.update(products).set({ stock: sql`${products.stock} + ${l.quantity}` }).where(eq(products.id, l.productId));
    }
  });
  return { ok: false, message: result.message, orderId };
}

class OutOfStock extends Error {
  constructor(readonly title: string) {
    super(`Out of stock: ${title}`);
  }
}

/** An order, only if it belongs to the user. */
export async function getOrder(userId: string, orderId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return null;
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.userId, userId)))
    .limit(1);
  if (!order) return null;
  const [items, events, [payment]] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, order.id)),
    db.select().from(orderEvents).where(eq(orderEvents.orderId, order.id)).orderBy(asc(orderEvents.at)),
    db
      .select({ provider: payments.provider, status: payments.status, cardBrand: payments.cardBrand, cardLast4: payments.cardLast4 })
      .from(payments)
      .where(eq(payments.orderId, order.id))
      .orderBy(desc(payments.createdAt))
      .limit(1),
  ]);
  return { order, items, events, payment: payment ?? null };
}

export async function listOrders(userId: string) {
  const rows = await db
    .select({
      id: orders.id,
      number: orders.number,
      status: orders.status,
      totalCents: orders.totalCents,
      createdAt: orders.createdAt,
      estimatedDeliveryFrom: orders.estimatedDeliveryFrom,
      estimatedDeliveryTo: orders.estimatedDeliveryTo,
    })
    .from(orders)
    .where(and(eq(orders.userId, userId), sql`${orders.status} <> 'payment_failed'`))
    .orderBy(desc(orders.createdAt));
  if (!rows.length) return [];
  const items = await db
    .select({ orderId: orderItems.orderId, title: orderItems.title, thumbnail: orderItems.thumbnail, quantity: orderItems.quantity })
    .from(orderItems)
    .where(inArray(orderItems.orderId, rows.map((r) => r.id)));
  return rows.map((r) => ({ ...r, items: items.filter((i) => i.orderId === r.id) }));
}
