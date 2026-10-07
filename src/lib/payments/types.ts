export type CardInput = { number: string; expiry: string; cvc: string; name: string };

export type ChargeResult =
  | { status: "succeeded"; providerRef: string; brand: string; last4: string }
  | { status: "failed"; message: string; last4?: string };

/**
 * Checkout talks to this interface. The simulated provider confirms on the
 * server immediately; Stripe test mode will slot in behind the same shape
 * (PaymentIntent + Payment Element + webhook) once keys are configured.
 */
export interface PaymentProvider {
  readonly name: "simulated" | "stripe";
  charge(input: { amountCents: number; idempotencyKey: string; card: CardInput }): Promise<ChargeResult>;
}
