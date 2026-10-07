"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { currentUserId } from "@/auth";
import { addressSchema, type AddressField } from "@/lib/address";
import { readCartId } from "@/lib/cart";
import type { CheckoutState } from "@/lib/checkout-errors";
import { placeOrder } from "@/lib/orders";
import { simulatedProvider, validateCard } from "@/lib/payments/simulated";

export type { CheckoutState } from "@/lib/checkout-errors";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "");

export async function placeOrderAction(_prev: CheckoutState, fd: FormData): Promise<CheckoutState> {
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
  const card = { number: str(fd, "cardNumber"), expiry: str(fd, "cardExpiry"), cvc: str(fd, "cardCvc"), name: str(fd, "cardName") };
  const cardError = validateCard(card);

  if (!address.success) {
    const fieldErrors: NonNullable<CheckoutState>["fieldErrors"] = {};
    for (const i of address.error.issues) fieldErrors[i.path[0] as AddressField] ??= i.message;
    const first = Object.values(fieldErrors)[0];
    return { code: "address", error: `Check your shipping address: ${first}`, fieldErrors };
  }
  if (cardError) return { code: "card", error: cardError, fieldErrors: { card: cardError } };

  const key = str(fd, "idempotencyKey");
  const result = await placeOrder({
    userId,
    cartId,
    address: address.data,
    speed: str(fd, "speed") === "expedited" ? "expedited" : "standard",
    idempotencyKey: UUID.test(key) ? key : crypto.randomUUID(),
    card,
    provider: simulatedProvider,
  });

  if (result.ok) {
    refresh(); // the header cart count lives in the shared layout
    redirect(`/orders/${result.orderId}?placed=1`);
  }
  return {
    code: result.code,
    error: result.message,
    fieldErrors: result.code === "card" ? { card: result.message } : undefined,
    idempotencyKey: crypto.randomUUID(),
  };
}
