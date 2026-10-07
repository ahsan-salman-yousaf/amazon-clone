/**
 * Specific, actionable copy for Stripe errors (owner decision: no generic
 * "something went wrong"). Each message says what happened and what to do.
 */
type StripeLikeError = { type?: string; code?: string; decline_code?: string; message?: string };

const DECLINES: Record<string, string> = {
  insufficient_funds: "Your card was declined for insufficient funds. Try a different card.",
  lost_card: "Your bank declined this card because it was reported lost. Use a different card.",
  stolen_card: "Your bank declined this card because it was reported stolen. Use a different card.",
  expired_card: "Your card has expired. Check the expiry date or use a different card.",
  incorrect_cvc: "The security code (CVC) is incorrect. Check the 3 digits on the back of your card.",
  card_velocity_exceeded: "Your card has hit its spending limit for now. Try a different card.",
  do_not_honor: "Your bank declined the payment without saying why. Contact your bank or try another card.",
  fraudulent: "This payment was declined as suspected fraud. Try a different card.",
  processing_error: "Your bank had a temporary problem processing the card. Wait a moment and try again.",
  generic_decline: "Your card was declined. Try a different card, or contact your bank.",
};

const CODES: Record<string, string> = {
  expired_card: DECLINES.expired_card,
  incorrect_cvc: DECLINES.incorrect_cvc,
  invalid_cvc: DECLINES.incorrect_cvc,
  incorrect_number: "The card number is incorrect. Check it and try again.",
  invalid_number: "That isn't a valid card number. Check it and try again.",
  invalid_expiry_month: "The expiry month is invalid. Use MM / YY.",
  invalid_expiry_year: "The expiry year is invalid. Use MM / YY.",
  incomplete_number: "Your card number is incomplete.",
  incomplete_expiry: "The expiry date is incomplete.",
  incomplete_cvc: "The security code is incomplete.",
  processing_error: DECLINES.processing_error,
  authentication_required: "Your bank needs to verify this payment. Complete the verification step to continue.",
  payment_intent_authentication_failure: "The payment wasn't verified with your bank, so nothing was charged. Try again and complete the verification.",
  rate_limit: "Too many attempts in a short time. Wait a few seconds and try again.",
};

export function describeStripeError(e: StripeLikeError): string {
  if (e.code === "card_declined" && e.decline_code && DECLINES[e.decline_code]) return DECLINES[e.decline_code];
  if (e.code && CODES[e.code]) return CODES[e.code];
  if (e.code === "card_declined") return DECLINES.generic_decline;
  if (e.type === "validation_error" && e.message) return e.message;
  if (e.type === "api_connection_error") return "We couldn't reach Stripe. Check your connection; nothing was charged.";
  return e.message ?? "Your payment didn't go through, and nothing was charged. Try again or use a different card.";
}
