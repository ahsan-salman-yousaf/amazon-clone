"use client";

import { useSyncExternalStore } from "react";
import { estimateArrival, formatArrival, STANDARD_TRANSIT_DAYS } from "@/lib/delivery";

const subscribe = () => () => {};

/**
 * The exact date depends on "today" in the shopper's timezone, so it can't be
 * baked into the prerendered page. The server renders a stable business-day
 * range; the browser swaps in the real date.
 */
export function DeliveryDate({ dispatchDaysMin, dispatchDaysMax }: { dispatchDaysMin: number; dispatchDaysMax: number }) {
  const exact = useSyncExternalStore(
    subscribe,
    () => formatArrival(estimateArrival(dispatchDaysMin)),
    () => null,
  );
  if (exact) return <>Arrives {exact}</>;
  const lo = dispatchDaysMin + STANDARD_TRANSIT_DAYS;
  const hi = dispatchDaysMax + STANDARD_TRANSIT_DAYS;
  return <>Arrives in {lo === hi ? lo : `${lo}–${hi}`} business days</>;
}
