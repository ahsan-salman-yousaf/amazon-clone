import type Stripe from "stripe";
import { findPayment, markFailed, markPaid } from "@/lib/orders";
import { cardDetails, stripe, stripeEnabled } from "@/lib/payments/stripe";

/**
 * Stripe → us. Signature-verified; handlers are idempotent, so retries and the
 * browser-side finalize can both land without double-processing.
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!stripeEnabled || !secret || !signature) return new Response("Not configured", { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(await request.text(), signature, secret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  if (event.type === "payment_intent.succeeded" || event.type === "payment_intent.payment_failed") {
    const pi = event.data.object;
    const payment = await findPayment({ providerRef: pi.id });
    if (payment) {
      if (event.type === "payment_intent.succeeded") {
        await markPaid(payment.id, { providerRef: pi.id, ...(await cardDetails(pi)) });
      } else {
        await markFailed(payment.id, pi.last_payment_error?.message ?? "Payment failed");
      }
    }
  }
  return Response.json({ received: true });
}
