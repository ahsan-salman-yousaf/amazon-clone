import type { AddressField } from "@/lib/address";

/** Where an error belongs, so checkout can show it on the right step. */
export type CheckoutErrorCode =
  | "address" // a shipping field is invalid → step 1, field highlighted
  | "stock" // an item sold out while checking out → link back to the cart
  | "cart_empty" // nothing left to buy
  | "card" // the card was declined or its details are wrong → step 3
  | "service" // the payment service couldn't be reached
  | "network"; // our server couldn't be reached

export type CheckoutState = {
  error: string;
  code: CheckoutErrorCode;
  fieldErrors?: Partial<Record<AddressField | "card", string>>;
  /** A fresh key after a failed attempt, so the retry is a new payment. */
  idempotencyKey?: string;
} | null;
