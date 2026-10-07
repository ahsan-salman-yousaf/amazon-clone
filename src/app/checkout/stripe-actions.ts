"use server";

import { and, eq, ne } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { currentUserId } from "@/auth";
import { db } from "@/db";
import { orders, payments } from "@/db/schema";
import { addressSchema, type AddressField } from "@/lib/address";
import { readCartId } from "@/lib/cart";
import { findPayment, markFailed, markPaid, reserveOrder, setProviderRef } from "@/lib/orders";
import { cardDetails, stripe, stripeEnabled } from "@/lib/payments/stripe";

export type StartPaymentResult =
  | { ok: true; clientSecret: string; paymentId: string; orderId: string }
  | { ok: false; error: string; fieldErrors?: Partial<Record<AddressField, string>> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "");

/** Payment attempts belong to the signed-in user; anything else is ignored. */
async function ownPayment(paymentId: string) {
  const userId = await currentUserId();
  if (!userId || !UUID.test(paymentId)) return null;
  const [row] = await db
    .select({ payment: payments, userId: orders.userId })
    .from(payments)
    .innerJoin(orders, eq(orders.id, payments.orderId))
    .where(and(eq(payments.id, paymentId), eq(orders.userId, userId)))
    .limit(1);
  return row?.payment ?? null;
}

/** Releases stock held by the user's earlier unfinished Stripe attempts. */
async function releaseAbandoned(userId: string, keep: string) {
  const stale = await db
    .select({ id: payments.id, ref: payments.providerRef })
    .from(payments)
    .innerJoin(orders, eq(orders.id, payments.orderId))
    .where(and(eq(orders.userId, userId), eq(payments.provider, "stripe"), eq(payments.status, "processing"), ne(payments.idempotencyKey, keep)));
  for (const p of stale) {
    if (p.ref) {
      const pi = await stripe().paymentIntents.retrieve(p.ref);
      if (pi.status === "succeeded") {
        await markPaid(p.id, { providerRef: pi.id, ...(await cardDetails(pi)) });
        continue;
      }
      if (pi.status !== "canceled") await stripe().paymentIntents.cancel(pi.id).catch(() => {});
    }
    await markFailed(p.id, "Checkout was restarted");
  }
}

/** Step 1: validate, re-price on the server, reserve stock, create the PaymentIntent. */
export async function startStripePayment(fd: FormData): Promise<StartPaymentResult> {
  if (!stripeEnabled) return { ok: false, error: "Payments are not configured." };
  const userId = await currentUserId();
  if (!userId) redirect("/signin?next=/checkout");
  const cartId = await readCartId();
  if (!cartId) redirect("/cart");

  const address = addressSchema.safeParse({
    fullName: str(fd, "fullName"),
    line1: str(fd, "line1"),
    line2: str(fd, "line2"),
    city: str(fd, "city"),
    state: str(fd, "state"),
    postalCode: str(fd, "postalCode"),
    phone: str(fd, "phone"),
  });
  if (!address.success) {
    const fieldErrors: Partial<Record<AddressField, string>> = {};
    for (const i of address.error.issues) fieldErrors[i.path[0] as AddressField] ??= i.message;
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }

  const key = UUID.test(str(fd, "idempotencyKey")) ? str(fd, "idempotencyKey") : crypto.randomUUID();

  // Same key again (double click, retry): reuse the attempt already made.
  const prior = await findPayment({ idempotencyKey: key });
  if (prior) {
    if (prior.status === "succeeded") redirect(`/orders/${prior.orderId}?placed=1`);
    if (prior.status === "processing" && prior.providerRef) {
      const pi = await stripe().paymentIntents.retrieve(prior.providerRef);
      if (pi.client_secret) return { ok: true, clientSecret: pi.client_secret, paymentId: prior.id, orderId: prior.orderId };
    }
    return { ok: false, error: "That attempt has ended. Please try again." };
  }

  await releaseAbandoned(userId, key);

  const reserved = await reserveOrder({
    userId,
    cartId,
    address: address.data,
    speed: str(fd, "speed") === "expedited" ? "expedited" : "standard",
    idempotencyKey: key,
    provider: "stripe",
  });
  if (!reserved.ok) return { ok: false, error: reserved.message };
  const { orderId, paymentId, totalCents } = reserved.reservation;

  try {
    const pi = await stripe().paymentIntents.create(
      {
        amount: totalCents,
        currency: "usd",
        allowed_payment_method_types: ["card"],
        description: "Olympus Cart demo order (Stripe test mode)",
        metadata: { orderId, paymentId },
      },
      { idempotencyKey: key },
    );
    await setProviderRef(paymentId, pi.id);
    return { ok: true, clientSecret: pi.client_secret!, paymentId, orderId };
  } catch {
    await markFailed(paymentId, "Couldn't start the payment");
    return { ok: false, error: "We couldn't reach the payment service. Please try again." };
  }
}

/** After a decline or error in the browser: end this attempt and return the stock. */
export async function cancelStripePayment(paymentId: string, message: string) {
  const payment = await ownPayment(paymentId);
  if (!payment || payment.status !== "processing") return;
  if (payment.providerRef) {
    const pi = await stripe().paymentIntents.retrieve(payment.providerRef);
    if (pi.status === "succeeded") return; // it actually went through; the webhook/finalize will record it
    if (pi.status !== "canceled") await stripe().paymentIntents.cancel(pi.id).catch(() => {});
  }
  await markFailed(paymentId, message.slice(0, 200));
}

/** Step 2: the browser says it succeeded; trust only what Stripe's API reports. */
export async function finalizeStripePayment(paymentId: string) {
  const payment = await ownPayment(paymentId);
  if (!payment?.providerRef) redirect("/cart");
  const pi = await stripe().paymentIntents.retrieve(payment.providerRef);
  if (pi.status === "succeeded") {
    await markPaid(payment.id, { providerRef: pi.id, ...(await cardDetails(pi)) });
    refresh();
  }
  // "processing" (rare for cards) is finished later by the webhook.
  redirect(`/orders/${payment.orderId}?placed=1`);
}
