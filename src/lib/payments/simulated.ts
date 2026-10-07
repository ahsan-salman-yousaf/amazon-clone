import "server-only";

import type { CardInput, ChargeResult, PaymentProvider } from "./types";

/**
 * Clearly labelled simulated provider (CLAUDE.md: test mode or simulated only).
 * It accepts published test card numbers ONLY and refuses anything else, so a
 * real card number is never processed. Card details are never stored or
 * logged; only the last four digits reach the database.
 */
export const TEST_CARDS: Record<string, { outcome: "succeeded" } | { outcome: "failed"; message: string }> = {
  "4242424242424242": { outcome: "succeeded" },
  "5555555555554444": { outcome: "succeeded" },
  "4000000000000002": { outcome: "failed", message: "Your card was declined." },
  "4000000000009995": { outcome: "failed", message: "Your card has insufficient funds." },
};

export const digits = (s: string) => s.replace(/\D/g, "");

export function validateCard(card: CardInput): string | null {
  const number = digits(card.number);
  if (!(number in TEST_CARDS)) return "This demo only accepts test cards, such as 4242 4242 4242 4242.";
  const m = card.expiry.match(/^\s*(\d{2})\s*\/\s*(\d{2})\s*$/);
  if (!m) return "Enter the expiry as MM/YY.";
  const month = Number(m[1]);
  const year = 2000 + Number(m[2]);
  const now = new Date();
  if (month < 1 || month > 12 || year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) {
    return "That expiry date has passed.";
  }
  if (!/^\d{3,4}$/.test(card.cvc.trim())) return "Enter the 3-digit security code.";
  if (!card.name.trim()) return "Enter the name on the card.";
  return null;
}

export const simulatedProvider: PaymentProvider = {
  name: "simulated",
  async charge({ idempotencyKey, card }): Promise<ChargeResult> {
    const number = digits(card.number);
    const last4 = number.slice(-4);
    const rule = TEST_CARDS[number];
    if (!rule) return { status: "failed", message: "This demo only accepts test cards.", last4 };
    if (rule.outcome === "failed") return { status: "failed", message: rule.message, last4 };
    return { status: "succeeded", providerRef: `sim_${idempotencyKey.replaceAll("-", "").slice(0, 24)}`, brand: number.startsWith("5") ? "Mastercard" : "Visa", last4 };
  },
};
