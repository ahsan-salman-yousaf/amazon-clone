export const CONTACT_TOPICS = {
  order: "An order",
  return: "A return or refund",
  account: "My account",
  product: "A product question",
  feedback: "Feedback about the store",
  other: "Something else",
} as const;
export type ContactTopic = keyof typeof CONTACT_TOPICS;
/** Topics that need an order number to be useful. */
export const TOPICS_WITH_ORDER: ContactTopic[] = ["order", "return"];
