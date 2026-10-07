import "server-only";

import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { addresses, cartItems, carts, orderEvents, orderItems, orders, payments, products, productVariants, returns, type ShippingAddress } from "@/db/schema";
import { withTransaction } from "@/db/tx";
import type { AddressInput } from "@/lib/address";
import { EXPRESS_TRANSIT_DAYS, STANDARD_TRANSIT_DAYS, addBusinessDays } from "@/lib/delivery";
import { orderTotals, type ShippingSpeed } from "@/lib/pricing";
import type { CardInput, PaymentProvider } from "@/lib/payments/types";
import { advanceOrders } from "@/lib/order-timeline";

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

export type OrderFailure = { ok: false; code: "stock" | "cart_empty" | "card"; message: string; orderId?: string };
export type PlaceOrderResult = { ok: true; orderId: string } | OrderFailure;

type OrderInput = {
  userId: string;
  cartId: string;
  address: AddressInput;
  speed: ShippingSpeed;
  idempotencyKey: string;
  provider: PaymentProvider["name"];
};

export type Reservation = { orderId: string; paymentId: string; totalCents: number };

/**
 * Step 1 for every provider. The server is the only source of truth for prices
 * and stock: the cart is re-read and re-priced here, never trusted from the
 * browser. Stock is taken and the order created in one transaction.
 */
export async function reserveOrder(input: OrderInput): Promise<{ ok: true; reservation: Reservation } | OrderFailure> {
  const lines = await db
    .select({
      productId: products.id,
      title: products.title,
      thumbnail: products.thumbnail,
      priceCents: products.priceCents,
      stock: sql<number>`case when ${products.sizeType} is not null and ${cartItems.variantId} is null then 0 else coalesce(${productVariants.stock}, ${products.stock}) end`.mapWith(Number),
      dispatchDaysMin: products.dispatchDaysMin,
      dispatchDaysMax: products.dispatchDaysMax,
      quantity: cartItems.quantity,
      variantId: cartItems.variantId,
      variantLabel: productVariants.label,
    })
    .from(cartItems)
    .innerJoin(products, eq(products.id, cartItems.productId))
    .leftJoin(productVariants, eq(productVariants.id, cartItems.variantId))
    .where(and(eq(cartItems.cartId, input.cartId), eq(cartItems.savedForLater, false)));

  const buyable = lines.filter((l) => l.stock > 0).map((l) => ({ ...l, quantity: Math.min(l.quantity, l.stock) }));
  if (!lines.length) return { ok: false, code: "cart_empty", message: "Your cart is empty. Add something before checking out." };
  if (!buyable.length) {
    const names = lines.map((l) => l.title).join(", ");
    return { ok: false, code: "stock", message: `${names} ${lines.length === 1 ? "is" : "are"} now out of stock.` };
  }

  const subtotal = buyable.reduce((s, l) => s + l.priceCents * l.quantity, 0);
  const totals = orderTotals(subtotal, input.speed);
  const transit = input.speed === "expedited" ? EXPRESS_TRANSIT_DAYS : STANDARD_TRANSIT_DAYS;
  const now = new Date();
  const from = addBusinessDays(now, Math.max(...buyable.map((l) => l.dispatchDaysMin)) + transit);
  const to = addBusinessDays(now, Math.max(...buyable.map((l) => l.dispatchDaysMax)) + transit);
  const shippingAddress: ShippingAddress = { ...input.address, country: "US" };

  try {
    const reservation = await withTransaction(async (tx) => {
      for (const l of buyable) {
        const taken = await tx
          .update(products)
          .set({ stock: sql`${products.stock} - ${l.quantity}` })
          .where(and(eq(products.id, l.productId), gte(products.stock, l.quantity)))
          .returning({ id: products.id });
        if (!taken.length) throw new OutOfStock(l.title);
        if (l.variantId) {
          const size = await tx
            .update(productVariants)
            .set({ stock: sql`${productVariants.stock} - ${l.quantity}` })
            .where(and(eq(productVariants.id, l.variantId), gte(productVariants.stock, l.quantity)))
            .returning({ id: productVariants.id });
          if (!size.length) throw new OutOfStock(`${l.title} (${l.variantLabel})`);
        }
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
          variantId: l.variantId,
          variantLabel: l.variantLabel,
          title: l.title,
          thumbnail: l.thumbnail,
          unitPriceCents: l.priceCents,
          quantity: l.quantity,
        })),
      );
      await tx.insert(orderEvents).values({ orderId: order.id, status: "pending_payment", note: "Order placed" });
      const [payment] = await tx
        .insert(payments)
        .values({ orderId: order.id, provider: input.provider, idempotencyKey: input.idempotencyKey, amountCents: totals.totalCents, status: "processing" })
        .returning({ id: payments.id });
      return { orderId: order.id, paymentId: payment.id, totalCents: totals.totalCents };
    });
    return { ok: true, reservation };
  } catch (e) {
    if (e instanceof OutOfStock) {
      return { ok: false, code: "stock", message: `${e.title} sold out while you were checking out. Remove it from your cart to continue.` };
    }
    throw e;
  }
}

/**
 * Step 2a. Idempotent: only the first call for a payment does anything, so the
 * browser return and the Stripe webhook can both report success safely.
 */
export async function markPaid(paymentId: string, details: { providerRef: string; brand: string | null; last4: string | null }) {
  const done = await withTransaction(async (tx) => {
    const [payment] = await tx
      .update(payments)
      .set({ status: "succeeded", providerRef: details.providerRef, cardBrand: details.brand, cardLast4: details.last4 })
      .where(and(eq(payments.id, paymentId), eq(payments.status, "processing")))
      .returning({ orderId: payments.orderId });
    if (!payment) return null;
    const [order] = await tx.update(orders).set({ status: "paid" }).where(eq(orders.id, payment.orderId)).returning();
    const card = details.last4 ? `Paid with ${details.brand ?? "card"} ending ${details.last4}` : "Payment confirmed";
    await tx.insert(orderEvents).values({ orderId: order.id, status: "paid", note: card });
    // Bought items leave the cart; saved-for-later stays.
    const bought = await tx
      .select({ productId: orderItems.productId, variantId: orderItems.variantId })
      .from(orderItems)
      .where(eq(orderItems.orderId, order.id));
    const [cart] = await tx.select({ id: carts.id }).from(carts).where(eq(carts.userId, order.userId)).limit(1);
    if (cart) {
      for (const b of bought) {
        await tx
          .delete(cartItems)
          .where(
            and(
              eq(cartItems.cartId, cart.id),
              eq(cartItems.savedForLater, false),
              eq(cartItems.productId, b.productId),
              sql`${cartItems.variantId} is not distinct from ${b.variantId}`,
            ),
          );
      }
    }
    return order;
  });
  if (done) {
    const a = done.shippingAddress;
    await saveDefaultAddress(done.userId, { fullName: a.fullName, line1: a.line1, line2: a.line2 ?? null, city: a.city, state: a.state, postalCode: a.postalCode, phone: a.phone ?? null });
  }
}

/** Step 2b. Idempotent: releases the reserved stock once. */
export async function markFailed(paymentId: string, message: string, last4?: string | null) {
  await withTransaction(async (tx) => {
    const [payment] = await tx
      .update(payments)
      .set({ status: "failed", failureMessage: message, cardLast4: last4 ?? null })
      .where(and(eq(payments.id, paymentId), eq(payments.status, "processing")))
      .returning({ orderId: payments.orderId });
    if (!payment) return;
    await tx.update(orders).set({ status: "payment_failed" }).where(eq(orders.id, payment.orderId));
    await tx.insert(orderEvents).values({ orderId: payment.orderId, status: "payment_failed", note: message });
    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, payment.orderId));
    for (const it of items) {
      await tx.update(products).set({ stock: sql`${products.stock} + ${it.quantity}` }).where(eq(products.id, it.productId));
      if (it.variantId) {
        await tx.update(productVariants).set({ stock: sql`${productVariants.stock} + ${it.quantity}` }).where(eq(productVariants.id, it.variantId));
      }
    }
  });
}

export async function findPayment(by: { idempotencyKey?: string; providerRef?: string; paymentId?: string }) {
  const where = by.paymentId
    ? eq(payments.id, by.paymentId)
    : by.providerRef
      ? eq(payments.providerRef, by.providerRef)
      : eq(payments.idempotencyKey, by.idempotencyKey ?? "");
  const [p] = await db.select().from(payments).where(where).limit(1);
  return p ?? null;
}

/** Records the provider's reference (e.g. the PaymentIntent id) on the attempt. */
export async function setProviderRef(paymentId: string, providerRef: string) {
  await db.update(payments).set({ providerRef }).where(eq(payments.id, paymentId));
}

/** Simulated provider: reserve, charge on the server, record the outcome. */
export async function placeOrder(input: Omit<OrderInput, "provider"> & { card: CardInput; provider: PaymentProvider }): Promise<PlaceOrderResult> {
  // A double-click or retry with the same key returns the first order.
  const prior = await findPayment({ idempotencyKey: input.idempotencyKey });
  if (prior) {
    return prior.status === "succeeded"
      ? { ok: true, orderId: prior.orderId }
      : { ok: false, code: "card", message: "That payment attempt already failed. Check your card details and try again.", orderId: prior.orderId };
  }
  const reserved = await reserveOrder({ ...input, provider: input.provider.name });
  if (!reserved.ok) return reserved;
  const { orderId, paymentId, totalCents } = reserved.reservation;
  const result = await input.provider.charge({ amountCents: totalCents, idempotencyKey: input.idempotencyKey, card: input.card });
  if (result.status === "succeeded") {
    await markPaid(paymentId, { providerRef: result.providerRef, brand: result.brand, last4: result.last4 });
    return { ok: true, orderId };
  }
  await markFailed(paymentId, result.message, result.last4);
  return { ok: false, code: "card", message: result.message, orderId };
}

class OutOfStock extends Error {
  constructor(readonly title: string) {
    super(`Out of stock: ${title}`);
  }
}

/** An order, only if it belongs to the user. */
export async function getOrder(userId: string, orderId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return null;
  await advanceOrders(userId, [orderId]);
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.userId, userId)))
    .limit(1);
  if (!order) return null;
  const [items, events, [payment]] = await Promise.all([
    db
      .select({
        productId: orderItems.productId,
        variantId: orderItems.variantId,
        variantLabel: orderItems.variantLabel,
        title: orderItems.title,
        thumbnail: orderItems.thumbnail,
        unitPriceCents: orderItems.unitPriceCents,
        quantity: orderItems.quantity,
        slug: products.slug,
      })
      .from(orderItems)
      .innerJoin(products, eq(products.id, orderItems.productId))
      .where(eq(orderItems.orderId, order.id)),
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
  await advanceOrders(userId);
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
    // Abandoned or failed attempts aren't orders the shopper placed.
    .where(and(eq(orders.userId, userId), sql`${orders.status} not in ('payment_failed', 'pending_payment', 'cancelled')`))
    .orderBy(desc(orders.createdAt));
  if (!rows.length) return [];
  const items = await db
    .select({ orderId: orderItems.orderId, title: orderItems.title, variantLabel: orderItems.variantLabel, thumbnail: orderItems.thumbnail, quantity: orderItems.quantity })
    .from(orderItems)
    .where(inArray(orderItems.orderId, rows.map((r) => r.id)));
  const rets = await db
    .select({ orderId: returns.orderId, status: returns.status, refundCents: returns.refundCents })
    .from(returns)
    .where(and(inArray(returns.orderId, rows.map((r) => r.id)), sql`${returns.status} <> 'cancelled'`));
  return rows.map((r) => {
    const mine = rets.filter((x) => x.orderId === r.id);
    const returnStatus = !mine.length
      ? null
      : mine.some((x) => x.status === "requested")
        ? ("in_progress" as const)
        : { refundedCents: mine.reduce((t, x) => t + x.refundCents, 0) };
    return { ...r, items: items.filter((i) => i.orderId === r.id), returnStatus };
  });
}
