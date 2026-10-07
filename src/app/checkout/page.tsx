import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { currentUserId } from "@/auth";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import { getCartView, readCartId } from "@/lib/cart";
import { listAddresses } from "@/lib/address-book";
import { getDefaultAddress } from "@/lib/orders";
import { stripeEnabled } from "@/lib/payments/stripe";

export const metadata: Metadata = { title: "Checkout" };

export default function CheckoutPage() {
  return (
    <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pt-8 pb-20 lg:px-8">
      <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">Checkout</h1>
      <Suspense fallback={<div className="glass mt-6 h-96 rounded-3xl" aria-hidden />}>
        <Checkout />
      </Suspense>
    </main>
  );
}

async function Checkout() {
  // Checkout requires sign-in, as on Amazon (PLAN.md P0).
  const userId = await currentUserId();
  if (!userId) redirect("/signin?next=/checkout");
  const [cart, address, saved] = await Promise.all([readCartId().then(getCartView), getDefaultAddress(userId), listAddresses(userId)]);
  const buyable = cart.lines.filter((l) => l.stock > 0).map((l) => ({ ...l, quantity: Math.min(l.quantity, l.stock) }));
  if (!buyable.length) redirect("/cart");

  return (
    <CheckoutForm
      lines={buyable.map(({ productId, title, thumbnail, priceCents, quantity }) => ({ productId, title, thumbnail, priceCents, quantity }))}
      subtotalCents={cart.subtotalCents}
      dispatch={{ min: Math.max(...buyable.map((l) => l.dispatchDaysMin)), max: Math.max(...buyable.map((l) => l.dispatchDaysMax)) }}
      address={address}
      savedAddresses={saved.map(({ id, fullName, line1, line2, city, state, postalCode, phone }) => ({ id, fullName, line1, line2, city, state, postalCode, phone }))}
      idempotencyKey={crypto.randomUUID()}
      stripePublishableKey={stripeEnabled ? process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY : undefined}
    />
  );
}
