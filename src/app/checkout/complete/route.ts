import { NextResponse, type NextRequest } from "next/server";
import { currentUserId } from "@/auth";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { findPayment, markPaid } from "@/lib/orders";
import { cardDetails, stripe, stripeEnabled } from "@/lib/payments/stripe";
import { eq } from "drizzle-orm";

/**
 * Return URL for payments that needed a redirect (e.g. 3-D Secure). Stripe
 * appends ?payment_intent=…; the order is finalized only after checking the
 * PaymentIntent with Stripe's API.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const piId = url.searchParams.get("payment_intent") ?? "";
  const userId = await currentUserId();
  if (!stripeEnabled || !userId || !/^pi_[A-Za-z0-9]+$/.test(piId)) return NextResponse.redirect(new URL("/cart", url));

  const payment = await findPayment({ providerRef: piId });
  if (!payment) return NextResponse.redirect(new URL("/cart", url));
  const [order] = await db.select({ userId: orders.userId }).from(orders).where(eq(orders.id, payment.orderId)).limit(1);
  if (order?.userId !== userId) return NextResponse.redirect(new URL("/cart", url));

  const pi = await stripe().paymentIntents.retrieve(piId);
  if (pi.status === "succeeded") {
    await markPaid(payment.id, { providerRef: pi.id, ...(await cardDetails(pi)) });
    return NextResponse.redirect(new URL(`/orders/${payment.orderId}?placed=1`, url));
  }
  return NextResponse.redirect(new URL("/checkout?payment=failed", url));
}
