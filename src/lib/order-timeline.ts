import "server-only";

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { orderEvents, orders } from "@/db/schema";

// Simulated fulfilment (owner decision): an order ships a few minutes after
// payment and is delivered on its estimated date. Worked out lazily when an
// order is read, and each event is stamped with when it "happened".
export const SHIP_AFTER_MS = 3 * 60 * 1000;
/** Deliveries land mid-afternoon US Eastern (19:00 UTC) on the estimated date. */
const deliveredAt = (isoDate: string) => new Date(`${isoDate}T19:00:00Z`);

export async function advanceOrders(userId: string, orderIds?: string[]) {
  const open = await db
    .select({ id: orders.id, status: orders.status, from: orders.estimatedDeliveryFrom })
    .from(orders)
    .where(and(eq(orders.userId, userId), inArray(orders.status, ["paid", "shipped"]), orderIds ? inArray(orders.id, orderIds) : undefined));
  if (!open.length) return;

  const paidEvents = await db
    .select({ orderId: orderEvents.orderId, at: orderEvents.at })
    .from(orderEvents)
    .where(and(inArray(orderEvents.orderId, open.map((o) => o.id)), eq(orderEvents.status, "paid")));
  const paidAt = new Map(paidEvents.map((e) => [e.orderId, e.at]));
  const now = Date.now();

  for (const o of open) {
    const paid = paidAt.get(o.id);
    if (!paid) continue;
    const shipAt = new Date(paid.getTime() + SHIP_AFTER_MS);
    const deliverAt = deliveredAt(o.from);
    if (o.status === "paid" && now >= shipAt.getTime()) {
      await db.insert(orderEvents).values({ orderId: o.id, status: "shipped", note: "Shipped from the Olympus Cart warehouse", at: shipAt });
      await db.update(orders).set({ status: "shipped" }).where(and(eq(orders.id, o.id), eq(orders.status, "paid")));
      o.status = "shipped";
    }
    if (o.status === "shipped" && now >= deliverAt.getTime()) {
      await db.insert(orderEvents).values({ orderId: o.id, status: "delivered", note: "Delivered", at: deliverAt });
      await db.update(orders).set({ status: "delivered" }).where(and(eq(orders.id, o.id), eq(orders.status, "shipped")));
    }
  }
}
