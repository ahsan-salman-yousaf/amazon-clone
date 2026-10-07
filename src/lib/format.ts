const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

/** 5499 -> "$54.99" */
export const formatMoney = (cents: number) => usd.format(cents / 100);

/** Percentage saved, rounded; 0 when there is no real discount. */
export const discountPercent = (priceCents: number, listPriceCents: number) =>
  listPriceCents > priceCents ? Math.round((1 - priceCents / listPriceCents) * 100) : 0;

/** 1410 -> "1.4K" */
export const formatCount = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K` : String(n);
