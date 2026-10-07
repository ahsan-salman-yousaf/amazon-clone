// Shipping policy (owner decision, docs/PLAN.md). All amounts in cents.
export const FREE_SHIPPING_THRESHOLD_CENTS = 3500;
export const STANDARD_SHIPPING_CENTS = 599;
export const EXPRESS_SHIPPING_CENTS = 999;

export type ShippingSpeed = "standard" | "expedited";

export function shippingCents(subtotalCents: number, speed: ShippingSpeed = "standard") {
  if (speed === "expedited") return EXPRESS_SHIPPING_CENTS;
  return subtotalCents >= FREE_SHIPPING_THRESHOLD_CENTS ? 0 : STANDARD_SHIPPING_CENTS;
}

/** How much more to spend for free standard delivery (0 once qualified). */
export const amountToFreeShipping = (subtotalCents: number) => Math.max(0, FREE_SHIPPING_THRESHOLD_CENTS - subtotalCents);
