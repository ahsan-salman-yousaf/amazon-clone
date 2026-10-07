"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * Shows a timestamp in the shopper's own timezone. The server renders UTC
 * (it can't know the timezone); the browser swaps in local time.
 */
export function LocalTime({ iso, withTime = true }: { iso: string; withTime?: boolean }) {
  const opts: Intl.DateTimeFormatOptions = withTime ? { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" } : { month: "short", day: "numeric", year: "numeric" };
  const local = useSyncExternalStore(
    subscribe,
    () => new Intl.DateTimeFormat("en-US", opts).format(new Date(iso)),
    () => null,
  );
  return (
    <time dateTime={iso}>{local ?? `${new Intl.DateTimeFormat("en-US", { ...opts, timeZone: "UTC" }).format(new Date(iso))}${withTime ? " UTC" : ""}`}</time>
  );
}
