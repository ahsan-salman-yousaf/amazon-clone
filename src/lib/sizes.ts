// Size options (owner decision): shoes, clothing and watches. Jewelry in the
// catalog is earrings only, so it stays unsized.

export type SizeType = "shoe_men" | "shoe_women" | "apparel" | "watch_band";

export const SIZE_TYPE_BY_CATEGORY: Record<string, SizeType> = {
  "mens-shoes": "shoe_men",
  "womens-shoes": "shoe_women",
  "mens-shirts": "apparel",
  tops: "apparel",
  "womens-dresses": "apparel",
  "mens-watches": "watch_band",
  "womens-watches": "watch_band",
};

export const SIZES: Record<SizeType, string[]> = {
  shoe_men: ["US 7", "US 7.5", "US 8", "US 8.5", "US 9", "US 9.5", "US 10", "US 10.5", "US 11", "US 12", "US 13"],
  shoe_women: ["US 5", "US 5.5", "US 6", "US 6.5", "US 7", "US 7.5", "US 8", "US 8.5", "US 9", "US 10", "US 11"],
  apparel: ["XS", "S", "M", "L", "XL", "XXL"],
  watch_band: ["S", "M", "L"],
};

export const SIZE_LABEL: Record<SizeType, string> = {
  shoe_men: "Size",
  shoe_women: "Size",
  apparel: "Size",
  watch_band: "Band size",
};

/** Size guide charts: header row, then one row per size. */
export const SIZE_GUIDES: Record<SizeType, { title: string; note: string; head: string[]; rows: string[][] }> = {
  shoe_men: {
    title: "Men's shoe sizes",
    note: "Measure your foot from heel to longest toe. Between sizes? Go half a size up.",
    head: ["US", "UK", "EU", "Foot length"],
    rows: [
      ["7", "6", "40", "25.0 cm"],
      ["7.5", "6.5", "40.5", "25.4 cm"],
      ["8", "7", "41", "25.7 cm"],
      ["8.5", "7.5", "42", "26.0 cm"],
      ["9", "8", "42.5", "26.7 cm"],
      ["9.5", "8.5", "43", "27.0 cm"],
      ["10", "9", "44", "27.3 cm"],
      ["10.5", "9.5", "44.5", "27.9 cm"],
      ["11", "10", "45", "28.3 cm"],
      ["12", "11", "46", "29.0 cm"],
      ["13", "12", "47.5", "29.7 cm"],
    ],
  },
  shoe_women: {
    title: "Women's shoe sizes",
    note: "Measure your foot from heel to longest toe. Between sizes? Go half a size up.",
    head: ["US", "UK", "EU", "Foot length"],
    rows: [
      ["5", "3", "35.5", "22.0 cm"],
      ["5.5", "3.5", "36", "22.4 cm"],
      ["6", "4", "36.5", "22.9 cm"],
      ["6.5", "4.5", "37", "23.2 cm"],
      ["7", "5", "37.5", "23.5 cm"],
      ["7.5", "5.5", "38", "24.0 cm"],
      ["8", "6", "38.5", "24.4 cm"],
      ["8.5", "6.5", "39", "24.8 cm"],
      ["9", "7", "40", "25.2 cm"],
      ["10", "8", "41", "26.0 cm"],
      ["11", "9", "42", "26.8 cm"],
    ],
  },
  apparel: {
    title: "Clothing sizes",
    note: "Measure around the fullest part of your chest and the narrowest part of your waist.",
    head: ["Size", "Chest", "Waist"],
    rows: [
      ["XS", "81–86 cm", "66–71 cm"],
      ["S", "86–94 cm", "71–79 cm"],
      ["M", "94–102 cm", "79–86 cm"],
      ["L", "102–109 cm", "86–94 cm"],
      ["XL", "109–117 cm", "94–102 cm"],
      ["XXL", "117–125 cm", "102–109 cm"],
    ],
  },
  watch_band: {
    title: "Watch band sizes",
    note: "Wrap a strip of paper around your wrist where you wear a watch and measure it.",
    head: ["Band", "Fits wrists"],
    rows: [
      ["S", "140–165 mm"],
      ["M", "160–185 mm"],
      ["L", "180–210 mm"],
    ],
  },
};

/**
 * Splits a product's stock across its sizes with a fixed, repeatable pattern
 * (owner decision): middle sizes get more, and a couple of edge sizes sell out,
 * so the demo shows "only 2 left" and sold-out states. Totals always match.
 */
export function splitStock(productId: number, total: number, labels: string[]): number[] {
  const n = labels.length;
  const mid = (n - 1) / 2;
  const weights = labels.map((_, i) => 1 / (1 + Math.abs(i - mid) ** 1.6));
  // Deterministic sell-outs: up to two edge sizes per product.
  const soldOut = new Set<number>();
  if (productId % 3 === 0) soldOut.add(0);
  if (productId % 4 === 1) soldOut.add(n - 1);
  if (total < n) for (let i = 0; i < n; i++) if (i % 2) soldOut.add(i);
  const w = weights.map((x, i) => (soldOut.has(i) ? 0 : x));
  const sum = w.reduce((a, b) => a + b, 0) || 1;
  const counts = w.map((x) => Math.floor((x / sum) * total));
  // Hand out the remainder to the biggest middle sizes so the total matches.
  let rest = total - counts.reduce((a, b) => a + b, 0);
  const order = w.map((x, i) => [x, i] as const).sort((a, b) => b[0] - a[0]);
  for (let k = 0; rest > 0; k = (k + 1) % order.length) {
    if (order[k][0] > 0) {
      counts[order[k][1]]++;
      rest--;
    }
  }
  // Make the smallest in-stock edge size scarce, for an honest "only N left".
  const firstInStock = counts.findIndex((c) => c > 0);
  if (firstInStock >= 0 && counts[firstInStock] > 3) {
    const move = counts[firstInStock] - 2;
    counts[firstInStock] = 2;
    counts[Math.round(mid)] += move;
  }
  return counts;
}
