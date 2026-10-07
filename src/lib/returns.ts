import "server-only";

import { and, asc, eq, inArray, lte, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { orderEvents, orderItems, orders, payments, products, returnItems, returns } from "@/db/schema";
import { withTransaction } from "@/db/tx";
import { advanceOrders } from "@/lib/order-timeline";
import { stripe, stripeEnabled } from "@/lib/payments/stripe";
import { TAX_RATE } from "@/lib/pricing";

export const RETURN_REASONS = {
  no_longer_needed: "No longer needed",
  damaged: "Arrived damaged",
  wrong_item: "Wrong item was sent",
  not_as_described: "Not as described",
  better_price: "Found a better price",
  other: "Other",
} as const;
export type ReturnReason = keyof typeof RETURN_REASONS;

/** Simulated: the parcel "reaches the warehouse" this long after the request, then the refund is issued. */
export const REFUND_AFTER_MS = 2 * 60 * 1000;

/** "30 days return policy" → 30; "No return policy" → 0. */
export function returnWindowDays(policy: string | null) {
  const m = policy?.match(/(\d+)\s*days?/i);
  return m ? Number(m[1]) : 0;
}

/** Items still within their window, and how many of each can still be returned. */
export async function returnableItems(userId: string, orderId: string) {
  await advanceOrders(userId, [orderId]);
  const [order] = await db
    .select({ id: orders.id, status: orders.status })
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.userId, userId)))
    .limit(1);
  if (!order) return null;
  const [delivered] = await db
    .select({ at: orderEvents.at })
    .from(orderEvents)
    .where(and(eq(orderEvents.orderId, orderId), eq(orderEvents.status, "delivered")))
    .limit(1);

  const items = await db
    .select({
      productId: orderItems.productId,
      title: orderItems.title,
      thumbnail: orderItems.thumbnail,
      unitPriceCents: orderItems.unitPriceCents,
      quantity: orderItems.quantity,
      returnPolicy: products.returnPolicy,
    })
    .from(orderItems)
    .innerJoin(products, eq(products.id, orderItems.productId))
    .where(eq(orderItems.orderId, orderId));

  const already = await db
    .select({ productId: returnItems.productId, qty: sql<number>`sum(${returnItems.quantity})::int` })
    .from(returnItems)
    .innerJoin(returns, eq(returns.id, returnItems.returnId))
    .where(and(eq(returns.orderId, orderId), ne(returns.status, "cancelled")))
    .groupBy(returnItems.productId);
  const returned = new Map(already.map((a) => [a.productId, a.qty]));

  const now = Date.now();
  return {
    delivered: order.status === "delivered" && !!delivered,
    deliveredAt: delivered?.at ?? null,
    items: items.map((it) => {
      const days = returnWindowDays(it.returnPolicy);
      const closesAt = delivered ? new Date(delivered.at.getTime() + days * 86_400_000) : null;
      const remaining = it.quantity - (returned.get(it.productId) ?? 0);
      const reason =
        days === 0
          ? "This item can't be returned (no return policy)."
          : !delivered
            ? "Returns open once the order is delivered."
            : closesAt && now > closesAt.getTime()
              ? `The ${days}-day return window closed on ${closesAt.toLocaleDateString("en-US", { month: "long", day: "numeric" })}.`
              : remaining <= 0
                ? "Already returned."
                : null;
      return { ...it, windowDays: days, closesAt, remaining: Math.max(0, remaining), blockedReason: reason };
    }),
  };
}

export type ReturnRequest = { productId: number; quantity: number }[];
export type CreateReturnResult = { ok: true; returnId: string } | { ok: false; error: string; field?: "items" | "reason" | "note" };

export async function createReturn(input: {
  userId: string;
  orderId: string;
  items: ReturnRequest;
  reason: string;
  note?: string;
}): Promise<CreateReturnResult> {

  const state = await returnableItems(input.userId, input.orderId);
  if (!state) return { ok: false, error: "We couldn't find that order on your account." };
  if (!state.delivered) return { ok: false, error: "Returns open once the order is delivered." };

  const wanted = input.items.filter((i) => i.quantity > 0);
  if (!wanted.length) return { ok: false, field: "items", error: "Select at least one item to return." };
  let itemsCents = 0;
  for (const w of wanted) {
    const it = state.items.find((i) => i.productId === w.productId);
    if (!it) return { ok: false, field: "items", error: "One of the selected items isn't part of this order." };
    if (it.blockedReason) return { ok: false, field: "items", error: `${it.title}: ${it.blockedReason}` };
    if (w.quantity > it.remaining) return { ok: false, field: "items", error: `You can return at most ${it.remaining} of ${it.title}.` };
    itemsCents += it.unitPriceCents * w.quantity;
  }
  // Checked in the order the form asks: items, then reason, then note.
  if (!(input.reason in RETURN_REASONS)) return { ok: false, field: "reason", error: "Choose why you're returning these items." };
  const note = input.note?.trim().slice(0, 500) || null;
  if (input.reason === "other" && !note) return { ok: false, field: "note", error: "Tell us a little about the reason so we can process the return." };

  // Refund the items plus the tax charged on them; delivery isn't refunded.
  const refundCents = itemsCents + Math.round(itemsCents * TAX_RATE);

  const returnId = await withTransaction(async (tx) => {
    const [r] = await tx
      .insert(returns)
      .values({ orderId: input.orderId, userId: input.userId, reason: input.reason as ReturnReason, note, refundCents })
      .returning({ id: returns.id });
    await tx.insert(returnItems).values(wanted.map((w) => ({ returnId: r.id, productId: w.productId, quantity: w.quantity })));
    return r.id;
  });
  return { ok: true, returnId };
}

/**
 * Lazily completes returns whose parcel has "arrived": refunds the payment
 * (a real Stripe test-mode refund when the order was paid with Stripe) and
 * puts the stock back. Idempotent: the Stripe refund uses the return id as its key.
 */
export async function processDueRefunds(orderId: string) {
  const due = await db
    .select()
    .from(returns)
    .where(and(eq(returns.orderId, orderId), eq(returns.status, "requested"), lte(returns.createdAt, new Date(Date.now() - REFUND_AFTER_MS))));
  if (!due.length) return;
  const [payment] = await db
    .select({ provider: payments.provider, ref: payments.providerRef })
    .from(payments)
    .where(and(eq(payments.orderId, orderId), eq(payments.status, "succeeded")))
    .limit(1);

  for (const r of due) {
    let refundRef = `sim_refund_${r.id.replaceAll("-", "").slice(0, 20)}`;
    if (payment?.provider === "stripe" && payment.ref && stripeEnabled) {
      try {
        const refund = await stripe().refunds.create({ payment_intent: payment.ref, amount: r.refundCents }, { idempotencyKey: `return-${r.id}` });
        refundRef = refund.id;
      } catch (e) {
        console.error("Stripe refund failed; will retry on next view", r.id, e);
        continue;
      }
    }
    await withTransaction(async (tx) => {
      const [done] = await tx
        .update(returns)
        .set({ status: "refunded", refundRef, refundedAt: new Date() })
        .where(and(eq(returns.id, r.id), eq(returns.status, "requested")))
        .returning({ id: returns.id });
      if (!done) return;
      const items = await tx.select().from(returnItems).where(eq(returnItems.returnId, r.id));
      for (const it of items) {
        await tx.update(products).set({ stock: sql`${products.stock} + ${it.quantity}` }).where(eq(products.id, it.productId));
      }
    });
  }
}

export async function listReturns(orderId: string) {
  await processDueRefunds(orderId);
  const rows = await db.select().from(returns).where(eq(returns.orderId, orderId)).orderBy(asc(returns.createdAt));
  if (!rows.length) return [];
  const items = await db
    .select({ returnId: returnItems.returnId, productId: returnItems.productId, quantity: returnItems.quantity, title: orderItems.title })
    .from(returnItems)
    .innerJoin(orderItems, and(eq(orderItems.productId, returnItems.productId), eq(orderItems.orderId, orderId)))
    .where(inArray(returnItems.returnId, rows.map((r) => r.id)));
  return rows.map((r) => ({ ...r, items: items.filter((i) => i.returnId === r.id) }));
}
