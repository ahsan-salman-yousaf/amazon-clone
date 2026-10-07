import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { orderItems, orders, products, reviews, users } from "@/db/schema";
import { withTransaction } from "@/db/tx";

/** True when the user has a paid (or later) order containing the product. */
export async function hasPurchased(userId: string, productId: number) {
  const [row] = await db
    .select({ id: orders.id })
    .from(orders)
    .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
    .where(and(eq(orders.userId, userId), eq(orderItems.productId, productId), inArray(orders.status, ["paid", "shipped", "delivered"])))
    .limit(1);
  return !!row;
}

export async function getOwnReview(userId: string, productId: number) {
  const [r] = await db
    .select({ rating: reviews.rating, title: reviews.title, comment: reviews.comment })
    .from(reviews)
    .where(and(eq(reviews.userId, userId), eq(reviews.productId, productId)))
    .limit(1);
  return r ?? null;
}

/**
 * One review per account per product: writing again updates it. The product's
 * average and count move with it, so the page and search agree.
 */
export async function saveReview(input: { userId: string; productId: number; rating: number; title: string; comment: string }) {
  const verified = await hasPurchased(input.userId, input.productId);
  const [user] = await db.select({ name: users.name }).from(users).where(eq(users.id, input.userId)).limit(1);
  return withTransaction(async (tx) => {
    const [existing] = await tx
      .select({ rating: reviews.rating })
      .from(reviews)
      .where(and(eq(reviews.userId, input.userId), eq(reviews.productId, input.productId)))
      .limit(1);
    if (existing) {
      await tx
        .update(reviews)
        .set({ rating: input.rating, title: input.title, comment: input.comment, verified, authorName: user.name, createdAt: new Date() })
        .where(and(eq(reviews.userId, input.userId), eq(reviews.productId, input.productId)));
      // Swap the old score for the new one in the running average.
      await tx
        .update(products)
        .set({ rating: sql`round(((${products.rating} * ${products.ratingCount} - ${existing.rating} + ${input.rating}) / ${products.ratingCount})::numeric, 1)` })
        .where(eq(products.id, input.productId));
    } else {
      await tx.insert(reviews).values({ productId: input.productId, userId: input.userId, authorName: user.name, rating: input.rating, title: input.title, comment: input.comment, verified });
      await tx
        .update(products)
        .set({
          rating: sql`round(((${products.rating} * ${products.ratingCount} + ${input.rating}) / (${products.ratingCount} + 1))::numeric, 1)`,
          ratingCount: sql`${products.ratingCount} + 1`,
        })
        .where(eq(products.id, input.productId));
    }
    const [p] = await tx.select({ slug: products.slug }).from(products).where(eq(products.id, input.productId)).limit(1);
    return { slug: p.slug, updated: !!existing, verified };
  });
}
