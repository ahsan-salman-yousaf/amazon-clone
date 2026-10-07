"use client";

import { useSyncExternalStore } from "react";
import { estimateArrival, formatArrival, STANDARD_TRANSIT_DAYS } from "@/lib/delivery";

const subscribe = () => () => {};
const formatLong = (d: Date) => d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

/**
 * The exact date depends on "today" in the shopper's timezone, so it can't be
 * baked into the prerendered page. The server renders a stable business-day
 * range; the browser swaps in the real date.
 */
export function DeliveryDate({
  dispatchDaysMin,
  dispatchDaysMax,
  transitDays = STANDARD_TRANSIT_DAYS,
  format = "short",
  prefix = "Arrives",
}: {
  dispatchDaysMin: number;
  dispatchDaysMax: number;
  transitDays?: number;
  format?: "short" | "long";
  prefix?: string;
}) {
  const exact = useSyncExternalStore(
    subscribe,
    () => (format === "long" ? formatLong : formatArrival)(estimateArrival(dispatchDaysMin, transitDays)),
    () => null,
  );
  if (exact) return <>{prefix ? `${prefix} ${exact}` : exact}</>;
  const lo = dispatchDaysMin + transitDays;
  const hi = dispatchDaysMax + transitDays;
  return <>{`${prefix ? `${prefix} in` : "In"} ${lo === hi ? lo : `${lo}–${hi}`} business day${hi === 1 ? "" : "s"}`}</>;
}
