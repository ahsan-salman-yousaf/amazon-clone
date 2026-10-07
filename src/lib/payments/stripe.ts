import "server-only";

import Stripe from "stripe";

// CLAUDE.md: payments run in Stripe TEST mode. Refuse live keys outright.
const secret = process.env.STRIPE_SECRET_KEY ?? "";
const publishable = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
if (secret.startsWith("sk_live_") || secret.startsWith("rk_live_") || publishable.startsWith("pk_live_")) {
  throw new Error("Live Stripe keys are not allowed: Olympus Cart runs in Stripe test mode only.");
}

/** Stripe is used when test keys are configured; otherwise checkout falls back to the simulated provider. */
export const stripeEnabled = secret.startsWith("sk_test_") && publishable.startsWith("pk_test_");

let client: Stripe | null = null;
export function stripe() {
  if (!stripeEnabled) throw new Error("Stripe test keys are not configured");
  return (client ??= new Stripe(secret));
}

/** Card brand + last 4 from a PaymentIntent's latest charge, for display only. */
export async function cardDetails(pi: Stripe.PaymentIntent) {
  const chargeId = typeof pi.latest_charge === "string" ? pi.latest_charge : pi.latest_charge?.id;
  if (!chargeId) return { brand: null, last4: null };
  const charge = await stripe().charges.retrieve(chargeId);
  const card = charge.payment_method_details?.card;
  const brand = card?.brand ? card.brand.charAt(0).toUpperCase() + card.brand.slice(1) : null;
  return { brand, last4: card?.last4 ?? null };
}
